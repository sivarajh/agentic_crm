"""
Loop execution mode.

Repeatedly delegates to a single agent until a termination condition
is met (e.g., the agent signals completion via artifact, or the max
iteration count is reached). Used for iterative refinement patterns
such as retrieval-augmented generation loops or self-correction.
"""
from __future__ import annotations

import logging
from typing import Any

from ..task_manager import TaskManager
from ...shared.a2a.models import A2AArtifact, RouteDecision

logger = logging.getLogger(__name__)

DEFAULT_MAX_ITERATIONS = 5
DONE_SIGNAL = "LOOP_DONE"   # Artifact name that signals loop termination


class LoopExecutor:
    """Iteratively delegates to an agent until done or max iterations hit."""

    def __init__(self, task_manager: TaskManager, max_iterations: int = DEFAULT_MAX_ITERATIONS) -> None:
        self._tm = task_manager
        self._max_iterations = max_iterations

    async def execute(
        self,
        step: RouteDecision,
        session_id: str,
        conversation_id: str,
        initial_input: str,
    ) -> list[A2AArtifact]:
        """
        Execute a single step in a loop until the agent signals LOOP_DONE
        or the maximum iteration count is reached.

        Each iteration passes accumulated artifacts back as context so the
        agent can refine its output progressively.

        Args:
            step: The routing decision (single agent + skill).
            session_id: Current session identifier.
            conversation_id: Current conversation identifier.
            initial_input: The original task input.

        Returns:
            All artifacts accumulated across all iterations.
        """
        accumulated: list[A2AArtifact] = []
        iteration = 0

        while iteration < self._max_iterations:
            iteration += 1
            logger.info(
                "Loop iteration %d/%d: agent=%s skill=%s",
                iteration, self._max_iterations, step.agent_url, step.skill_id
            )

            metadata: dict[str, Any] = {
                "session_id": session_id,
                "conversation_id": conversation_id,
                "loop_iteration": iteration,
                "max_iterations": self._max_iterations,
            }

            if accumulated:
                metadata["previous_artifacts"] = [
                    {"name": a.name, "description": a.description}
                    for a in accumulated
                ]

            try:
                new_artifacts = await self._tm.delegate(
                    agent_url=step.agent_url,
                    skill_id=step.skill_id,
                    input_text=initial_input,
                    session_id=session_id,
                    metadata=metadata,
                )
                accumulated.extend(new_artifacts)

                # Check for done signal
                if any(a.name == DONE_SIGNAL for a in new_artifacts):
                    logger.info("Loop terminated by agent signal at iteration %d", iteration)
                    break

            except Exception as exc:
                logger.error("Loop iteration %d failed: %s", iteration, exc)
                accumulated.append(A2AArtifact(
                    name=f"loop_iteration_{iteration}_error",
                    description=str(exc),
                    parts=[],
                ))
                break  # Stop loop on unrecoverable error

        else:
            logger.warning(
                "Loop reached max iterations (%d) without DONE signal for agent=%s",
                self._max_iterations, step.agent_url
            )

        return accumulated
