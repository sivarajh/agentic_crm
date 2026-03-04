"""
CRM Web Search Agent — searches the web and returns structured results via A2A protocol.

Accepts a search query (intent text), runs web search (DuckDuckGo or Tavily),
and returns the results as a "web_search_results" artifact for the orchestrator
to include in the Gemini prompt.
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
from web_search_agent.tools.search_tool import web_search

tracer = get_tracer("crm.web-search-agent")

WEB_SEARCH_AGENT_CARD = AgentCard(
    name="crm-web-search-agent",
    display_name="CRM Web Search Agent",
    description=(
        "Searches the web for real-time information on any topic and returns "
        "structured results (title, url, snippet) ready for LLM summarisation."
    ),
    version="0.1.0",
    url=settings.web_search_agent_url,
    capabilities=AgentCapabilities(
        streaming=False,
        state_transition_history=True,
    ),
    skills=[
        AgentSkill(
            id="web_search",
            name="Web Search",
            description="Search the web for a topic and return ranked results with snippets",
            tags=["search", "web", "realtime"],
        ),
        AgentSkill(
            id="web_summarize",
            name="Web Search & Summarize",
            description="Search the web and return a concise summary of the top results",
            tags=["search", "web", "summary"],
        ),
    ],
)


async def handle_task(task: A2ATask) -> list[A2AArtifact]:
    """Handle incoming A2A web search tasks."""
    with tracer.start_as_current_span("web_search_agent.handle_task") as span:
        span.set_attribute("task.id", task.task_id)

        # Extract search query from message parts
        query = " ".join(
            p.text for p in task.message.parts if p.type == "text" and p.text
        ).strip()

        # Allow caller to override max results via metadata
        max_results: int = int(task.metadata.get("max_results", 6))

        span.set_attribute("search.query", query[:200])
        span.set_attribute("search.max_results", max_results)

        if not query:
            return [A2AArtifact(
                name="web_search_results",
                mime_type="application/json",
                content={"query": "", "results": [], "error": "Empty search query"},
            )]

        results = await web_search(query=query, max_results=max_results)
        span.set_attribute("search.results_count", len(results))

        return [A2AArtifact(
            name="web_search_results",
            mime_type="application/json",
            content={
                "query": query,
                "results": results,
                "result_count": len(results),
            },
        )]


@asynccontextmanager
async def lifespan(app: FastAPI):
    setup_telemetry("crm-web-search-agent")
    yield


app = FastAPI(title="CRM Web Search Agent", version="0.1.0", lifespan=lifespan)
a2a_server = A2AServer(agent_card=WEB_SEARCH_AGENT_CARD, task_handler=handle_task)
a2a_server.mount(app)


@app.get("/health")
async def health():
    from shared.config.settings import settings as s
    provider = "google" if (s.google_api_key and s.google_cse_id) else "duckduckgo"
    return {"status": "ok", "service": "crm-web-search-agent", "search_provider": provider}


@app.get("/metrics")
async def metrics():
    return {"info": "metrics exported via OTLP"}
