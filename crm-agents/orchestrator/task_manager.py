"""
Task Manager — delegates A2A tasks to sub-agents and aggregates results.
"""
from __future__ import annotations

import asyncio
from typing import Any

from shared.a2a.client import A2AClient
from shared.a2a.models import A2ATask, A2ATaskStatus, A2AArtifact, A2AMessage
from shared.config.settings import settings
from shared.otel.setup import get_tracer

tracer = get_tracer("crm.orchestrator.task_manager")


class TaskManager:

    def __init__(self) -> None:
        self._clients: dict[str, A2AClient] = {
            "crm-memory-agent":        A2AClient(settings.memory_agent_url),
            "crm-context-agent":       A2AClient(settings.context_agent_url),
            "crm-web-search-agent":    A2AClient(settings.web_search_agent_url),
            "crm-news-research-agent": A2AClient(settings.news_research_agent_url),
        }

    async def delegate(
        self,
        agent_id: str,
        session_id: str,
        intent: str,
        metadata: dict | None = None,
    ) -> A2ATask:
        """Delegate a task to a sub-agent and wait for completion."""
        client = self._clients.get(agent_id)
        if client is None:
            raise ValueError(f"Unknown sub-agent: {agent_id}")

        with tracer.start_as_current_span("orchestrator.delegate") as span:
            span.set_attribute("sub_agent", agent_id)
            span.set_attribute("session.id", session_id)

            return await client.send_and_wait(
                session_id=session_id,
                text=intent,
                metadata=metadata or {},
            )

    async def delegate_parallel(
        self,
        agents: list[str],
        session_id: str,
        intent: str,
        metadata: dict | None = None,
    ) -> list[A2ATask]:
        """Delegate to multiple sub-agents simultaneously."""
        tasks = [
            self.delegate(agent_id, session_id, intent, metadata)
            for agent_id in agents
        ]
        return list(await asyncio.gather(*tasks, return_exceptions=False))

    async def delegate_sequential(
        self,
        agents: list[str],
        session_id: str,
        intents: list[str],
        initial_metadata: dict | None = None,
    ) -> list[A2ATask]:
        """
        Delegate tasks sequentially, passing each result as context to the next.
        intents[i] is used for agents[i]; if len(intents) == 1 the same intent is used.
        """
        results: list[A2ATask] = []
        metadata = initial_metadata or {}

        for i, agent_id in enumerate(agents):
            intent = intents[i] if i < len(intents) else intents[-1]
            # Pass previous artifacts as context
            if results:
                last_artifacts = results[-1].artifacts
                metadata = {
                    **metadata,
                    "previous_artifacts": [a.model_dump() for a in last_artifacts],
                }
            result = await self.delegate(agent_id, session_id, intent, metadata)
            results.append(result)

        return results
