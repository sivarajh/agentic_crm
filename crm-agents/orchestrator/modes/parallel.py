"""
Parallel execution mode.

Dispatches multiple agent tasks simultaneously using asyncio.gather,
then collects all results. Useful when sub-tasks are independent of
each other (e.g., running memory retrieval and context fetch at the
same time).
"""
from __future__ import annotations

import asyncio
import logging
from typing import Any

from ..task_manager import TaskManager
from ...shared.a2a.models import A2AArtifact, RouteDecision

logger = logging.getLogger(__name__)


class ParallelExecutor:
    """Runs tasks concurrently and merges all artifacts."""

    def __init__(self, task_manager: TaskManager) -> None:
        self._tm = task_manager

    async def execute(
        self,
        steps: list[RouteDecision],
        session_id: str,
        conversation_id: str,
        initial_input: str,
    ) -> list[A2AArtifact]:
        """
        Execute all steps in parallel.

        Args:
            steps: List of routing decisions to execute concurrently.
            session_id: Current session identifier.
            conversation_id: Current conversation identifier.
            initial_input: Shared input text sent to all agents.

        Returns:
            Merged list of artifacts from all steps (order reflects task completion).
        """
        base_metadata: dict[str, Any] = {
            "session_id": session_id,
            "conversation_id": conversation_id,
            "execution_mode": "parallel",
            "total_parallel_steps": len(steps),
        }

        async def _run_step(step: RouteDecision, index: int) -> list[A2AArtifact]:
            metadata = {**base_metadata, "step_index": index}
            try:
                return await self._tm.delegate(
                    agent_url=step.agent_url,
                    skill_id=step.skill_id,
                    input_text=initial_input,
                    session_id=session_id,
                    metadata=metadata,
                )
            except Exception as exc:
                logger.error(
                    "Parallel step %d failed (agent=%s skill=%s): %s",
                    index, step.agent_url, step.skill_id, exc
                )
                return [A2AArtifact(
                    name=f"parallel_step_{index}_error",
                    description=f"Step {index} failed: {exc}",
                    parts=[],
                )]

        task_coroutines = [
            _run_step(step, i) for i, step in enumerate(steps)
        ]

        results: list[list[A2AArtifact]] = await asyncio.gather(*task_coroutines)

        # Flatten results while preserving relative order
        all_artifacts: list[A2AArtifact] = []
        for artifact_list in results:
            all_artifacts.extend(artifact_list)

        logger.info(
            "Parallel execution: %d steps completed, %d artifacts collected",
            len(steps), len(all_artifacts)
        )
        return all_artifacts
