"""
Sequential execution mode.

Executes a list of agent tasks one after another, passing the artifacts
from each completed task as context metadata into the next task.
This creates a pipeline where each step builds on the previous result.
"""
from __future__ import annotations

import asyncio
import logging
from typing import Any

from ..task_manager import TaskManager
from ...shared.a2a.models import A2AArtifact, RouteDecision

logger = logging.getLogger(__name__)


class SequentialExecutor:
    """Runs tasks in strict sequence, chaining artifacts between steps."""

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
        Execute steps sequentially.

        Args:
            steps: Ordered list of routing decisions (agent + skill + input).
            session_id: Current session identifier.
            conversation_id: Current conversation identifier.
            initial_input: The original user input / task description.

        Returns:
            Accumulated list of all artifacts from all completed steps.
        """
        accumulated_artifacts: list[A2AArtifact] = []
        previous_artifacts: list[A2AArtifact] = []

        for i, step in enumerate(steps):
            logger.info(
                "Sequential step %d/%d: agent=%s skill=%s",
                i + 1, len(steps), step.agent_url, step.skill_id
            )

            metadata: dict[str, Any] = {
                "session_id": session_id,
                "conversation_id": conversation_id,
                "step_index": i,
                "total_steps": len(steps),
            }

            # Pass previous artifacts as structured context
            if previous_artifacts:
                metadata["previous_artifacts"] = [
                    {"name": a.name, "description": a.description, "parts": [p.dict() for p in a.parts]}
                    for a in previous_artifacts
                ]

            try:
                result_artifacts = await self._tm.delegate(
                    agent_url=step.agent_url,
                    skill_id=step.skill_id,
                    input_text=initial_input,
                    session_id=session_id,
                    metadata=metadata,
                )
                accumulated_artifacts.extend(result_artifacts)
                previous_artifacts = result_artifacts

            except Exception as exc:
                logger.error(
                    "Sequential step %d failed (agent=%s skill=%s): %s",
                    i + 1, step.agent_url, step.skill_id, exc
                )
                # Attach error artifact and continue remaining steps if possible
                error_artifact = A2AArtifact(
                    name=f"step_{i+1}_error",
                    description=f"Step {i+1} failed: {exc}",
                    parts=[],
                )
                accumulated_artifacts.append(error_artifact)

        return accumulated_artifacts
