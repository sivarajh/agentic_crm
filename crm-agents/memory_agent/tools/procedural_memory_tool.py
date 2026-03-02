"""Procedural Memory tool — read workflow definitions and playbooks."""
from __future__ import annotations

from shared.clients.backend_client import BackendClient

backend = BackendClient()


async def get_procedures(agent_scope: str | None = None) -> list[dict]:
    """Retrieve active procedural memory entries for this agent."""
    params = {}
    if agent_scope:
        params["agentScope"] = agent_scope
    result = await backend.get("/api/v1/memory/procedural", params)
    return result.get("data", [])


async def get_procedure_by_id(procedure_id: str) -> dict:
    """Get a specific procedure by its ID."""
    return await backend.get(f"/api/v1/memory/procedural/{procedure_id}")
