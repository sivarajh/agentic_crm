"""
A2A Protocol server — embedded in every agent service.
Implements the standard A2A HTTP endpoints.
"""
from __future__ import annotations

import asyncio
import json
import uuid
from typing import Callable, Awaitable, Any

from fastapi import FastAPI, HTTPException, BackgroundTasks, Request
from fastapi.responses import Response
from sse_starlette.sse import EventSourceResponse

from shared.a2a.models import (
    A2ATask, A2ATaskStatus, A2AArtifact,
    TaskSendRequest, AgentCard, A2AMessage,
)
from shared.a2a.task_registry import TaskRegistry
from shared.otel.setup import get_tracer

tracer = get_tracer("crm.a2a.server")

TaskHandler = Callable[[A2ATask], Awaitable[list[A2AArtifact]]]


class A2AServer:
    """
    Implements A2A protocol endpoints for an agent.

    Usage:
        server = A2AServer(agent_card, handler_fn)
        app.include_router(server.router, prefix="")
    """

    def __init__(self, agent_card: AgentCard, task_handler: TaskHandler) -> None:
        self.agent_card = agent_card
        self.task_handler = task_handler
        self.registry = TaskRegistry()

    def mount(self, app: FastAPI) -> None:
        """Register A2A routes on an existing FastAPI app."""

        @app.get("/.well-known/agent.json", tags=["A2A"])
        async def get_agent_card():
            return self.agent_card.model_dump(mode="json")

        @app.post("/a2a/tasks/send", tags=["A2A"])
        async def send_task(
            request: TaskSendRequest,
            background: BackgroundTasks,
        ):
            with tracer.start_as_current_span("a2a.task.send") as span:
                task = A2ATask(
                    task_id=request.task_id or str(uuid.uuid4()),
                    session_id=request.session_id,
                    status=A2ATaskStatus.SUBMITTED,
                    message=request.message,
                    metadata=request.metadata,
                )
                span.set_attribute("task.id", task.task_id)
                span.set_attribute("session.id", task.session_id)

                await self.registry.register(task)
                background.add_task(self._execute_task, task)
                return {"task_id": task.task_id, "status": task.status.value}

        @app.get("/a2a/tasks/{task_id}", tags=["A2A"])
        async def get_task(task_id: str):
            task = await self.registry.get(task_id)
            if task is None:
                raise HTTPException(status_code=404, detail=f"Task {task_id} not found")
            return task.model_dump(mode="json")

        @app.get("/a2a/tasks/{task_id}/stream", tags=["A2A"])
        async def stream_task(task_id: str):
            async def event_generator():
                async for task in self.registry.subscribe_events(task_id):
                    yield {
                        "event": task.status.value,
                        "data": task.model_dump_json(),
                    }
            return EventSourceResponse(event_generator())

        @app.post("/a2a/tasks/{task_id}/cancel", tags=["A2A"])
        async def cancel_task(task_id: str):
            await self.registry.cancel(task_id)
            return {"task_id": task_id, "status": "cancelled"}

    async def _execute_task(self, task: A2ATask) -> None:
        await self.registry.update_status(task.task_id, A2ATaskStatus.WORKING)
        with tracer.start_as_current_span("a2a.task.execute") as span:
            span.set_attribute("task.id", task.task_id)
            try:
                artifacts = await self.task_handler(task)
                await self.registry.complete(task.task_id, artifacts or [])
                span.set_attribute("task.status", "completed")
            except Exception as exc:
                error = str(exc)
                await self.registry.fail(task.task_id, error)
                span.record_exception(exc)
                span.set_attribute("task.status", "failed")
