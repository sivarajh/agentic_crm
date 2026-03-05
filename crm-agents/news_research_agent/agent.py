"""
CRM News & Research Agent — deep research powered by Perplexity sonar.

Accepts any research query via A2A, calls Perplexity's search-augmented
sonar-pro model, and returns a structured artifact containing:
  - The synthesised research answer
  - Cited source URLs
  - The model used

This agent acts as the Perplexity MCP server integration layer: it grounds
the orchestrator's LLM responses with real-time, cited web research.
"""
from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI

from shared.a2a.models import (
    AgentCard, AgentCapabilities, AgentSkill,
    A2ATask, A2AArtifact,
)
from shared.a2a.server import A2AServer
from shared.config.settings import settings
from shared.otel.setup import setup_telemetry, get_tracer
from news_research_agent.tools.perplexity_tool import perplexity_research

tracer = get_tracer("crm.news-research-agent")

NEWS_RESEARCH_AGENT_CARD = AgentCard(
    name="crm-news-research-agent",
    display_name="CRM News & Research Agent",
    description=(
        "Provides deep, cited research on any topic using Perplexity's sonar "
        "search-augmented models. Returns synthesised answers with source URLs "
        "suitable for grounding LLM responses with real-time web knowledge."
    ),
    version="0.1.0",
    url=settings.news_research_agent_url,
    capabilities=AgentCapabilities(
        streaming=False,
        state_transition_history=True,
    ),
    skills=[
        AgentSkill(
            id="research",
            name="Deep Research",
            description=(
                "Run a comprehensive research query using Perplexity sonar-pro. "
                "Returns a synthesised answer with cited sources."
            ),
            tags=["research", "perplexity", "citations", "grounding"],
        ),
        AgentSkill(
            id="news_search",
            name="News Search",
            description=(
                "Search for the latest news and current events on a topic. "
                "Returns recent articles with sources."
            ),
            tags=["news", "current-events", "realtime"],
        ),
        AgentSkill(
            id="fact_check",
            name="Fact Check",
            description="Verify claims or statements against live web sources.",
            tags=["fact-check", "verify", "accuracy"],
        ),
    ],
)


async def handle_task(task: A2ATask) -> list[A2AArtifact]:
    """Handle incoming A2A research tasks via Perplexity."""
    with tracer.start_as_current_span("news_research_agent.handle_task") as span:
        span.set_attribute("task.id", task.task_id)

        # Extract query from message parts
        query = " ".join(
            p.text for p in task.message.parts if p.type == "text" and p.text
        ).strip()

        # Allow caller to select a specific Perplexity model via metadata
        model: str | None = task.metadata.get("perplexity_model")
        max_tokens: int = int(task.metadata.get("max_tokens", 1024))

        span.set_attribute("research.query", query[:200])
        span.set_attribute("research.model", model or settings.perplexity_model)

        if not query:
            return [A2AArtifact(
                name="research_results",
                mime_type="application/json",
                content={
                    "query": "",
                    "answer": "",
                    "citations": [],
                    "error": "Empty research query",
                },
            )]

        result = await perplexity_research(
            query=query,
            model=model,
            max_tokens=max_tokens,
        )

        span.set_attribute("research.citations_count", len(result.get("citations", [])))
        span.set_attribute("research.answer_len", len(result.get("answer", "")))

        return [A2AArtifact(
            name="research_results",
            mime_type="application/json",
            content={
                "query": query,
                "answer": result.get("answer", ""),
                "citations": result.get("citations", []),
                "model": result.get("model", ""),
                "error": result.get("error"),
            },
        )]


@asynccontextmanager
async def lifespan(app: FastAPI):
    setup_telemetry("crm-news-research-agent")
    yield


app = FastAPI(
    title="CRM News & Research Agent",
    version="0.1.0",
    lifespan=lifespan,
)
a2a_server = A2AServer(
    agent_card=NEWS_RESEARCH_AGENT_CARD,
    task_handler=handle_task,
)
a2a_server.mount(app)


@app.get("/health")
async def health():
    has_key = bool(settings.perplexity_api_key)
    return {
        "status": "ok",
        "service": "crm-news-research-agent",
        "provider": "perplexity" if has_key else "unconfigured",
        "model": settings.perplexity_model if has_key else None,
    }


@app.get("/metrics")
async def metrics():
    return {"info": "metrics exported via OTLP"}
