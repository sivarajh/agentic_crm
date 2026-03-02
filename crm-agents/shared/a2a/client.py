"""
A2A Protocol client — used by orchestrator to delegate tasks to sub-agents.
"""
from __future__ import annotations

import asyncio
from typing import Optional

import httpx

from shared.a2a.models import A2ATask, A2ATaskStatus, A2AArtifact, TaskSendRequest, AgentCard
from shared.otel.setup import get_tracer

tracer = get_tracer("crm.a2a.client")


class A2AClient:

    def __init__(self, agent_url: str, timeout: float = 30.0) -> None:
        self.agent_url = agent_url.rstrip("/")
        self.timeout = timeout

    async def get_agent_card(self) -> AgentCard:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(f"{self.agent_url}/.well-known/agent.json")
            resp.raise_for_status()
            return AgentCard.model_validate(resp.json())

    async def send_task(self, request: TaskSendRequest) -> str:
        """Submit a task and return task_id."""
        with tracer.start_as_current_span("a2a.client.send_task") as span:
            span.set_attribute("agent.url", self.agent_url)
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                resp = await client.post(
                    f"{self.agent_url}/a2a/tasks/send",
                    json=request.model_dump(mode="json"),
                )
                resp.raise_for_status()
                return resp.json()["task_id"]

    async def get_task(self, task_id: str) -> Optional[A2ATask]:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(f"{self.agent_url}/a2a/tasks/{task_id}")
            if resp.status_code == 404:
                return None
            resp.raise_for_status()
            return A2ATask.model_validate(resp.json())

    async def wait_for_completion(
        self,
        task_id: str,
        poll_interval: float = 0.5,
        max_wait: float = 60.0,
    ) -> A2ATask:
        """Poll until a task reaches terminal state. Returns final task."""
        terminal = {A2ATaskStatus.COMPLETED, A2ATaskStatus.FAILED, A2ATaskStatus.CANCELLED}
        elapsed = 0.0
        while elapsed < max_wait:
            task = await self.get_task(task_id)
            if task and task.status in terminal:
                return task
            await asyncio.sleep(poll_interval)
            elapsed += poll_interval
        raise TimeoutError(f"Task {task_id} did not complete within {max_wait}s")

    async def send_and_wait(
        self,
        session_id: str,
        text: str,
        metadata: dict | None = None,
    ) -> A2ATask:
        """Convenience: send a text task and wait for completion."""
        from shared.a2a.models import A2AMessage, MessagePart
        request = TaskSendRequest(
            session_id=session_id,
            message=A2AMessage.text(text),
            metadata=metadata or {},
        )
        task_id = await self.send_task(request)
        return await self.wait_for_completion(task_id)
