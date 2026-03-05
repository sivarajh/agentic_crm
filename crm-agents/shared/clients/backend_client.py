"""
HTTP client for the crm-backend REST API.
Used by Python agent services to read/write sessions, memory, compliance, etc.
"""
from __future__ import annotations

from typing import Any

import httpx

from shared.config.settings import settings
from shared.otel.setup import get_tracer

tracer = get_tracer("crm.backend.client")


class BackendClient:

    def __init__(self) -> None:
        self.base_url = settings.backend_url.rstrip("/")
        self.timeout = settings.backend_timeout_s

    def _headers(self) -> dict[str, str]:
        return {
            "Content-Type": "application/json",
            "X-Internal-API-Key": settings.internal_api_key,
        }

    async def get(self, path: str, params: dict | None = None) -> Any:
        with tracer.start_as_current_span(f"backend.GET {path}"):
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                resp = await client.get(
                    f"{self.base_url}{path}",
                    params=params,
                    headers=self._headers(),
                )
                resp.raise_for_status()
                return resp.json()

    async def post(self, path: str, body: dict) -> Any:
        with tracer.start_as_current_span(f"backend.POST {path}"):
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                resp = await client.post(
                    f"{self.base_url}{path}",
                    json=body,
                    headers=self._headers(),
                )
                resp.raise_for_status()
                return resp.json()

    async def put(self, path: str, body: dict) -> Any:
        with tracer.start_as_current_span(f"backend.PUT {path}"):
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                resp = await client.put(
                    f"{self.base_url}{path}",
                    json=body,
                    headers=self._headers(),
                )
                resp.raise_for_status()
                return resp.json()

    # ─── Convenience methods ──────────────────────────────────────────────────

    async def record_audit_event(
        self,
        event_type: str,
        action: str,
        session_id: str | None = None,
        agent_id: str | None = None,
        user_id: str | None = None,
        metadata: dict | None = None,
    ) -> dict:
        return await self.post("/api/v1/compliance/audit", {
            "eventType": event_type,
            "action": action,
            "sessionId": session_id,
            "agentId": agent_id,
            "userId": user_id,
            "metadata": metadata or {},
        })

    async def flag_for_review(
        self,
        audit_event_id: str,
        flagged_by: str,
        flag_reason: str,
        flag_details: dict | None = None,
    ) -> dict:
        return await self.post(f"/api/v1/compliance/review/{audit_event_id}", {
            "flaggedBy": flagged_by,
            "flagReason": flag_reason,
            "flagDetails": flag_details or {},
        })

    async def get_context(
        self, context_id: str, session_id: str, agent_id: str, user_id: str
    ) -> dict:
        return await self.get(f"/api/v1/context/{context_id}", {
            "sessionId": session_id,
            "agentId": agent_id,
            "userId": user_id,
        })

    async def append_message(
        self,
        conversation_id: str,
        role: str,
        content: str,
        agent_id: str | None = None,
        token_count: int | None = None,
    ) -> dict:
        return await self.post(f"/api/v1/conversations/{conversation_id}/messages", {
            "role": role,
            "content": content,
            "agentId": agent_id,
            "tokenCount": token_count,
        })

    async def get_conversation_messages(
        self,
        conversation_id: str,
        limit: int = 20,
    ) -> list[dict]:
        """
        Fetch the most recent messages for a conversation.

        The backend returns a Spring Page response:
          { "success": true, "data": { "content": [...], ... } }

        Returns a list of { role, content } dicts ordered oldest → newest,
        capped at `limit` entries.
        """
        try:
            data = await self.get(
                f"/api/v1/conversations/{conversation_id}/messages",
                params={"page": 0, "size": limit, "sort": "createdAt,asc"},
            )
            page_data = data.get("data", data)
            msgs = page_data.get("content", [])
            return [
                {"role": m.get("role", ""), "content": m.get("content", "")}
                for m in msgs
                if m.get("content")
            ]
        except Exception:
            return []

    async def push_stream_event(
        self,
        task_id: str,
        event_type: str,
        data: dict,
    ) -> None:
        """
        POST /api/v1/agent/tasks/{taskId}/events

        Fire-and-forget: pushes a streaming chunk event to the session SSE channel.
        Errors are logged at DEBUG level and suppressed so streaming never blocks.
        """
        try:
            async with httpx.AsyncClient(timeout=2.0) as client:
                await client.post(
                    f"{self.base_url}/api/v1/agent/tasks/{task_id}/events",
                    json={"eventType": event_type, "data": data},
                    headers=self._headers(),
                )
        except Exception as exc:  # noqa: BLE001
            import logging
            logging.getLogger(__name__).debug(
                "push_stream_event suppressed: %s", exc
            )

    async def update_agent_task_status(
        self,
        task_id: str,
        status: str,                        # "COMPLETED" | "FAILED"
        result: dict | None = None,
        error: str | None = None,
    ) -> dict:
        """
        PATCH /api/v1/agent/tasks/{taskId}/status

        Notifies the backend that the orchestrator has finished processing a task.
        This updates the task record in the backend's Redis so callers polling
        GET /api/v1/agent/tasks/{taskId} see the final status.
        """
        with tracer.start_as_current_span(f"backend.PATCH agent/tasks/{task_id}/status"):
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                resp = await client.patch(
                    f"{self.base_url}/api/v1/agent/tasks/{task_id}/status",
                    json={
                        "status": status,
                        "result": result or {},
                        "error": error,
                    },
                    headers=self._headers(),
                )
                resp.raise_for_status()
                return resp.json()
