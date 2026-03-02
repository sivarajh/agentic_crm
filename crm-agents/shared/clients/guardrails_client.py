"""
HTTP client for the crm-guardrails service.

Design choices:
- Short 5-second timeout so guardrails never block the LLM path for long.
- Fail-open: any network or HTTP error returns a "passed" result so the
  orchestrator can continue rather than dropping the request.
"""
from __future__ import annotations

import logging
from typing import Any

import httpx

from shared.config.settings import settings

logger = logging.getLogger(__name__)

_TIMEOUT = 5  # seconds — guardrails should respond fast


class GuardrailsClient:
    """Thin async HTTP wrapper around the crm-guardrails service."""

    def __init__(self) -> None:
        self._base_url = settings.guardrails_url.rstrip("/")

    async def validate_input(
        self,
        content: str,
        session_id: str | None = None,
        user_id: str | None = None,
        agent_id: str | None = None,
    ) -> dict[str, Any]:
        """
        POST /guardrails/validate/input

        Returns:
            {
                "passed": bool,
                "violations": [{"type": str, "severity": str, "detail": str}],
                "redacted_content": str | None,
            }
        """
        try:
            async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
                resp = await client.post(
                    f"{self._base_url}/guardrails/validate/input",
                    json={
                        "content": content,
                        "session_id": session_id,
                        "user_id": user_id,
                        "agent_id": agent_id,
                    },
                )
                resp.raise_for_status()
                return resp.json()
        except Exception as exc:
            logger.warning(
                "Guardrails input validation failed (fail-open): %s", exc
            )
            return {"passed": True, "violations": [], "redacted_content": None}

    async def validate_output(
        self,
        content: str,
        session_id: str | None = None,
        agent_id: str | None = None,
    ) -> dict[str, Any]:
        """
        POST /guardrails/validate/output

        Returns same shape as validate_input.
        """
        try:
            async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
                resp = await client.post(
                    f"{self._base_url}/guardrails/validate/output",
                    json={
                        "content": content,
                        "session_id": session_id,
                        "agent_id": agent_id,
                    },
                )
                resp.raise_for_status()
                return resp.json()
        except Exception as exc:
            logger.warning(
                "Guardrails output validation failed (fail-open): %s", exc
            )
            return {"passed": True, "violations": [], "redacted_content": None}
