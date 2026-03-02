"""
CRM Memory Agent — manages all four memory types via A2A protocol.
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
from memory_agent.tools.working_memory_tool import get_working_memory, set_working_memory
from memory_agent.tools.semantic_memory_tool import semantic_search, upsert_semantic_memory
from memory_agent.tools.episodic_memory_tool import record_episode, get_entity_episodes
from memory_agent.tools.procedural_memory_tool import get_procedures

tracer = get_tracer("crm.memory-agent")

MEMORY_AGENT_CARD = AgentCard(
    name="crm-memory-agent",
    display_name="CRM Memory Agent",
    description=(
        "Manages all four memory types: working, semantic, episodic, and procedural. "
        "Provides read/write/search across memory systems."
    ),
    version="0.1.0",
    url=settings.memory_agent_url,
    capabilities=AgentCapabilities(
        streaming=False,
        state_transition_history=True,
    ),
    skills=[
        AgentSkill(id="memory_read", name="Read Memory",
                   description="Read from any memory type by key or semantic search",
                   tags=["memory", "read"]),
        AgentSkill(id="memory_write", name="Write Memory",
                   description="Write or update any memory type",
                   tags=["memory", "write"]),
        AgentSkill(id="semantic_search", name="Semantic Search",
                   description="Vector similarity search across semantic and episodic memory",
                   tags=["memory", "search", "vector"]),
        AgentSkill(id="consolidate_memory", name="Consolidate Memory",
                   description="Move working memory insights into long-term stores",
                   tags=["memory", "consolidation"]),
    ],
)


async def handle_task(task: A2ATask) -> list[A2AArtifact]:
    """Handle incoming A2A memory tasks based on skill_id in metadata."""
    with tracer.start_as_current_span("memory_agent.handle_task") as span:
        span.set_attribute("task.id", task.task_id)

        skill_id = task.metadata.get("skill_id", "semantic_search")
        session_id = task.session_id

        # Extract text intent
        intent = " ".join(
            p.text for p in task.message.parts if p.type == "text" and p.text
        )

        if skill_id == "semantic_search" or skill_id == "memory_read":
            results = await semantic_search(query=intent, top_k=5)
            return [A2AArtifact(
                name="semantic_search_results",
                mime_type="application/json",
                content={"query": intent, "results": results},
            )]

        elif skill_id == "memory_write":
            entity_id = task.metadata.get("entity_id", session_id)
            entity_type = task.metadata.get("entity_type", "session")
            await upsert_semantic_memory(
                content=intent,
                entity_id=entity_id,
                entity_type=entity_type,
            )
            await record_episode(
                entity_id=entity_id,
                entity_type=entity_type,
                event_type="MEMORY_WRITE",
                summary=intent[:500],
                session_id=session_id,
                agent_id="crm-memory-agent",
            )
            return [A2AArtifact(
                name="memory_write_result",
                mime_type="application/json",
                content={"status": "stored", "entity_id": entity_id},
            )]

        elif skill_id == "consolidate_memory":
            procedures = await get_procedures(agent_scope="crm-memory-agent")
            return [A2AArtifact(
                name="consolidation_result",
                mime_type="application/json",
                content={"procedures_available": len(procedures), "status": "consolidation_pending"},
            )]

        # Default: return procedures + recent episodes
        procedures = await get_procedures()
        return [A2AArtifact(
            name="memory_context",
            mime_type="application/json",
            content={"procedures": procedures, "intent": intent},
        )]


@asynccontextmanager
async def lifespan(app: FastAPI):
    setup_telemetry("crm-memory-agent")
    yield


app = FastAPI(title="CRM Memory Agent", version="0.1.0", lifespan=lifespan)
a2a_server = A2AServer(agent_card=MEMORY_AGENT_CARD, task_handler=handle_task)
a2a_server.mount(app)


@app.get("/health")
async def health():
    return {"status": "ok", "service": "crm-memory-agent"}


@app.get("/metrics")
async def metrics():
    return {"info": "metrics exported via OTLP"}
