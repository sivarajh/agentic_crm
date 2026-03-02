"""
Task registry backed by Redis for multi-replica A2A task tracking.
"""
from __future__ import annotations

import json
import asyncio
from typing import Optional
from redis.asyncio import Redis

from shared.a2a.models import A2ATask, A2ATaskStatus, A2AArtifact
from shared.config.settings import settings

TASK_TTL = 7200  # 2 hours in seconds


class TaskRegistry:

    def __init__(self) -> None:
        self._redis: Redis | None = None

    async def _get_redis(self) -> Redis:
        if self._redis is None:
            self._redis = Redis(
                host=settings.redis_host,
                port=settings.redis_port,
                password=settings.redis_password or None,
                db=settings.redis_db,
                decode_responses=True,
            )
        return self._redis

    async def register(self, task: A2ATask) -> None:
        r = await self._get_redis()
        await r.set(
            f"a2a:task:{task.task_id}",
            task.model_dump_json(),
            ex=TASK_TTL,
        )
        # Publish for SSE streaming subscribers
        await r.publish(f"a2a:task:events:{task.task_id}", task.model_dump_json())

    async def get(self, task_id: str) -> Optional[A2ATask]:
        r = await self._get_redis()
        raw = await r.get(f"a2a:task:{task_id}")
        if raw is None:
            return None
        return A2ATask.model_validate_json(raw)

    async def update_status(self, task_id: str, status: A2ATaskStatus) -> None:
        task = await self.get(task_id)
        if task is None:
            return
        updated = task.model_copy(update={"status": status})
        await self.register(updated)

    async def complete(self, task_id: str, artifacts: list[A2AArtifact]) -> None:
        task = await self.get(task_id)
        if task is None:
            return
        updated = task.model_copy(update={
            "status": A2ATaskStatus.COMPLETED,
            "artifacts": artifacts,
        })
        await self.register(updated)

    async def fail(self, task_id: str, error: str) -> None:
        task = await self.get(task_id)
        if task is None:
            return
        updated = task.model_copy(update={
            "status": A2ATaskStatus.FAILED,
            "error": error,
        })
        await self.register(updated)

    async def cancel(self, task_id: str) -> None:
        await self.update_status(task_id, A2ATaskStatus.CANCELLED)

    async def subscribe_events(self, task_id: str):
        """Async generator yielding task updates for SSE streaming."""
        r = await self._get_redis()
        pubsub = r.pubsub()
        await pubsub.subscribe(f"a2a:task:events:{task_id}")
        terminal = {A2ATaskStatus.COMPLETED, A2ATaskStatus.FAILED, A2ATaskStatus.CANCELLED}
        try:
            async for message in pubsub.listen():
                if message["type"] != "message":
                    continue
                task = A2ATask.model_validate_json(message["data"])
                yield task
                if task.status in terminal:
                    break
        finally:
            await pubsub.unsubscribe(f"a2a:task:events:{task_id}")
            await pubsub.aclose()
