"""Episodic Memory tool — record and retrieve time-stamped interaction episodes."""
from __future__ import annotations

from shared.clients.backend_client import BackendClient

backend = BackendClient()


async def record_episode(
    entity_id: str,
    entity_type: str,
    event_type: str,
    summary: str,
    session_id: str | None = None,
    agent_id: str | None = None,
    metadata: dict | None = None,
) -> dict:
    """Record a new episodic memory entry."""
    return await backend.post("/api/v1/memory/episodic", {
        "entityId": entity_id,
        "entityType": entity_type,
        "eventType": event_type,
        "summary": summary,
        "sessionId": session_id,
        "agentId": agent_id,
        "metadata": metadata or {},
    })


async def get_entity_episodes(
    entity_id: str,
    entity_type: str | None = None,
    limit: int = 10,
) -> list[dict]:
    """Retrieve recent episodes for an entity."""
    params = {"limit": str(limit)}
    if entity_type:
        params["entityType"] = entity_type
    result = await backend.get(f"/api/v1/memory/episodic/entity/{entity_id}", params)
    return result.get("data", [])
