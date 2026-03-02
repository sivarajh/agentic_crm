"""
CRM Context Agent — assembles and maintains the unified context fabric.
"""
from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI

from shared.a2a.models import (
    AgentCard, AgentCapabilities, AgentSkill,
    A2ATask, A2AArtifact,
)
from shared.a2a.server import A2AServer
from shared.clients.backend_client import BackendClient
from shared.config.settings import settings
from shared.otel.setup import setup_telemetry, get_tracer

tracer = get_tracer("crm.context-agent")
backend = BackendClient()

CONTEXT_AGENT_CARD = AgentCard(
    name="crm-context-agent",
    display_name="CRM Context Agent",
    description="Assembles and maintains the unified context fabric for agent task execution.",
    version="0.1.0",
    url=settings.context_agent_url,
    capabilities=AgentCapabilities(
        streaming=False,
        state_transition_history=False,
    ),
    skills=[
        AgentSkill(id="build_context", name="Build Context",
                   description="Assemble full agent context from session, memory, and user profile",
                   tags=["context", "assembly"]),
        AgentSkill(id="update_context", name="Update Context",
                   description="Update context fields after agent actions",
                   tags=["context", "update"]),
    ],
)


async def handle_task(task: A2ATask) -> list[A2AArtifact]:
    """Build or update context for a session."""
    with tracer.start_as_current_span("context_agent.handle_task") as span:
        span.set_attribute("task.id", task.task_id)
        span.set_attribute("session.id", task.session_id)

        skill_id = task.metadata.get("skill_id", "build_context")
        session_id = task.session_id
        user_id = task.metadata.get("userId", "")
        agent_id = task.metadata.get("agentId", "crm-orchestrator")
        context_id = task.metadata.get("contextId", session_id)

        if skill_id == "build_context":
            context = await backend.get_context(
                context_id=context_id,
                session_id=session_id,
                agent_id=agent_id,
                user_id=user_id,
            )
            return [A2AArtifact(
                name="agent_context",
                mime_type="application/json",
                content=context.get("data", {}),
            )]

        elif skill_id == "update_context":
            patch = {}
            for part in task.message.parts:
                if part.type == "data" and part.data:
                    patch.update(part.data)
            updated = await backend.post(f"/api/v1/context/{context_id}", patch)
            return [A2AArtifact(
                name="updated_context",
                mime_type="application/json",
                content=updated.get("data", {}),
            )]

        return []


@asynccontextmanager
async def lifespan(app: FastAPI):
    setup_telemetry("crm-context-agent")
    yield


app = FastAPI(title="CRM Context Agent", version="0.1.0", lifespan=lifespan)
a2a_server = A2AServer(agent_card=CONTEXT_AGENT_CARD, task_handler=handle_task)
a2a_server.mount(app)


@app.get("/health")
async def health():
    return {"status": "ok", "service": "crm-context-agent"}


@app.get("/metrics")
async def metrics():
    return {"info": "metrics exported via OTLP"}
