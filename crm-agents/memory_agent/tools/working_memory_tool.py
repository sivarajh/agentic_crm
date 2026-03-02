"""Working Memory tool — reads/writes session-scoped Redis working memory."""
from __future__ import annotations

from shared.clients.backend_client import BackendClient

backend = BackendClient()


async def get_working_memory(session_id: str, key: str) -> dict:
    """Read a working memory key for a session."""
    return await backend.get(f"/api/v1/memory/working/{session_id}/{key}")


async def set_working_memory(session_id: str, key: str, value: str) -> dict:
    """Write a key into working memory for a session."""
    return await backend.put(f"/api/v1/memory/working/{session_id}/{key}", {"value": value})


async def push_reasoning_step(session_id: str, step: str) -> dict:
    """Append a reasoning step to the working memory reasoning list."""
    return await backend.post(f"/api/v1/memory/working/{session_id}/reasoning", {"step": step})
