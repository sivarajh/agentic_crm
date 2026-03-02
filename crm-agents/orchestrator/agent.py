"""
CRM Orchestrator Agent — central coordinator powered by Google Gemini.

End-to-end flow for each incoming A2A task:
  1. Extract user intent from the message
  2. Input guardrails (PII / injection check — fail-open)
  3. Fetch session context + relevant memories in PARALLEL
  4. Generate a CRM-aware response via Gemini (with context + memory grounding)
  5. Output guardrails (PII redaction on the LLM response)
  6. Persist user + agent turns to conversation history
  7. Return the response and orchestration metadata as A2A artifacts
"""
from __future__ import annotations

import asyncio
import json
import logging
from contextlib import asynccontextmanager
from typing import Any

from fastapi import FastAPI

from orchestrator.router import AgentRouter
from orchestrator.task_manager import TaskManager
from shared.a2a.models import (
    AgentCard, AgentCapabilities, AgentSkill,
    A2ATask, A2AArtifact, A2AMessage,
)
from shared.a2a.server import A2AServer
from shared.clients.backend_client import BackendClient
from shared.clients.guardrails_client import GuardrailsClient
from shared.config.settings import settings
from shared.llm.gemini_client import get_gemini_client
from shared.otel.setup import setup_telemetry, get_tracer

logger = logging.getLogger(__name__)
tracer = get_tracer("crm.orchestrator")

# ── Agent Card ────────────────────────────────────────────────────────────────

ORCHESTRATOR_CARD = AgentCard(
    schema_version="0.3",
    name="crm-orchestrator",
    display_name="CRM Orchestrator Agent",
    description=(
        "Central AI coordinator for all CRM agentic workflows. "
        "Uses Gemini to generate grounded responses enriched with session "
        "context and memory, with full guardrails on input and output."
    ),
    version="0.2.0",
    url=settings.orchestrator_url,
    capabilities=AgentCapabilities(
        streaming=True,
        push_notifications=True,
        state_transition_history=True,
        parallel_task_execution=True,
    ),
    skills=[
        AgentSkill(
            id="crm_query",
            name="CRM Query",
            description=(
                "Answer any CRM question (customer lookup, deal status, "
                "support history) using Gemini + retrieved memory"
            ),
            tags=["llm", "crm", "query"],
        ),
        AgentSkill(
            id="route_task",
            name="Route Task",
            description="Analyse intent and route to appropriate sub-agents",
            tags=["routing", "orchestration"],
        ),
        AgentSkill(
            id="execute_parallel",
            name="Parallel Workflow",
            description="Dispatch multiple agent tasks simultaneously",
            tags=["workflow", "parallel"],
        ),
    ],
)

# ── Singletons (module-level, created once per process) ───────────────────────

router = AgentRouter()
task_manager = TaskManager()
backend = BackendClient()
guardrails = GuardrailsClient()


# ── Helper: safely extract artifact content ───────────────────────────────────

def _extract_artifact(
    task_result: A2ATask | Exception,
    artifact_name: str,
) -> dict:
    """Return the content dict of a named artifact, or {} on any error."""
    if isinstance(task_result, Exception):
        logger.warning("Sub-task failed: %s", task_result)
        return {}
    for art in (task_result.artifacts or []):
        if art.name == artifact_name and isinstance(art.content, dict):
            return art.content
    return {}


# ── A2UI helpers ─────────────────────────────────────────────────────────────

def _ensure_a2ui(text: str) -> str:
    """
    Guarantee the response is valid A2UI v0.8 JSON.

    If Gemini returned proper A2UI JSON (has schema_version + components),
    return it unchanged.  Otherwise wrap the text/markdown content in a
    minimal A2UI envelope so the UI always receives structured data.
    """
    import re as _re

    stripped = text.strip()

    # Strip accidental markdown code fences: ```json ... ```
    fence_match = _re.search(r"```(?:json)?\s*([\s\S]*?)```", stripped)
    if fence_match:
        stripped = fence_match.group(1).strip()

    # Try to parse as JSON
    try:
        parsed = json.loads(stripped)
        if (
            isinstance(parsed, dict)
            and "schema_version" in parsed
            and "components" in parsed
        ):
            return stripped   # Already valid A2UI

        # JSON but not A2UI — wrap as kv_table or text
        return json.dumps({
            "schema_version": "0.8",
            "components": [{"type": "text", "content": str(parsed)}],
        })
    except (json.JSONDecodeError, ValueError):
        pass

    # Plain text / markdown fallback — wrap in markdown component
    return json.dumps({
        "schema_version": "0.8",
        "components": [
            {"type": "markdown", "content": stripped or "(empty response)"},
        ],
    })


# ── Core task handler ─────────────────────────────────────────────────────────

async def handle_task(task: A2ATask) -> list[A2AArtifact]:
    """
    Orchestrate an end-to-end LLM-powered CRM response.

    Returns a list of A2A artifacts:
      - "crm_response"          — the Gemini-generated answer
      - "orchestration_metadata" — routing and retrieval diagnostics
    """
    with tracer.start_as_current_span("orchestrator.handle_task") as span:
        span.set_attribute("task.id", task.task_id)
        span.set_attribute("session.id", task.session_id)

        session_id = task.session_id
        user_id: str | None = task.metadata.get("userId")

        # ── 1. Extract intent ──────────────────────────────────────────────
        intent: str = " ".join(
            part.text
            for part in task.message.parts
            if part.type == "text" and part.text
        ).strip()

        if not intent:
            return [A2AArtifact(
                name="crm_response",
                mime_type="application/json",
                content={"response": "No message content provided.", "session_id": session_id},
            )]

        span.set_attribute("task.intent", intent[:200])

        # ── 2. Input guardrails (fail-open) ────────────────────────────────
        input_check = await guardrails.validate_input(
            content=intent,
            session_id=session_id,
            user_id=user_id,
            agent_id="crm-orchestrator",
        )
        span.set_attribute("guardrails.input_passed", input_check.get("passed", True))

        if not input_check.get("passed", True):
            violations = input_check.get("violations", [])
            # Block on CRITICAL / HIGH severity only
            high_sev = [
                v for v in violations
                if v.get("severity") in ("CRITICAL", "HIGH")
            ]
            if high_sev:
                logger.warning(
                    "Input blocked by guardrails (session=%s violations=%d)",
                    session_id, len(high_sev),
                )
                blocked_result = {
                    "blocked": True,
                    "reason": "Input failed safety guardrails",
                    "violations": violations,
                }
                try:
                    await backend.update_agent_task_status(
                        task_id=task.task_id, status="COMPLETED", result=blocked_result
                    )
                except Exception:
                    pass
                return [A2AArtifact(
                    name="guardrails_blocked",
                    mime_type="application/json",
                    content=blocked_result,
                )]
            # Low/medium — use redacted version but continue
            intent = input_check.get("redacted_content") or intent

        # ── 3. Fetch context + memories in parallel ────────────────────────
        sub_metadata: dict[str, Any] = {
            "session_id": session_id,
            "orchestrator_task_id": task.task_id,
            "userId": user_id,
            "agentId": "crm-orchestrator",
            "contextId": session_id,
            **task.metadata,
        }

        context_result, memory_result = await asyncio.gather(
            task_manager.delegate(
                "crm-context-agent",
                session_id,
                intent,
                {**sub_metadata, "skill_id": "build_context"},
            ),
            task_manager.delegate(
                "crm-memory-agent",
                session_id,
                intent,
                {**sub_metadata, "skill_id": "semantic_search"},
            ),
            return_exceptions=True,
        )

        context_data = _extract_artifact(context_result, "agent_context")
        memory_data = _extract_artifact(memory_result, "semantic_search_results")
        memory_items: list[dict] = memory_data.get("results", [])

        span.set_attribute("context.fields_count", len(context_data))
        span.set_attribute("memory.results_count", len(memory_items))

        # ── 4. Build context / memory snippets for the prompt ─────────────
        context_snippet = json.dumps(context_data, indent=2) if context_data else ""

        memory_lines: list[str] = []
        for m in memory_items[:6]:
            # Qdrant results nest payload; plain dicts may use 'content'/'summary'
            payload = m.get("payload", m)
            text = (
                payload.get("content")
                or payload.get("summary")
                or payload.get("text")
                or ""
            )
            if text:
                memory_lines.append(f"- {str(text)[:300]}")
        memory_snippet = "\n".join(memory_lines)

        # ── 5. LLM: generate CRM response ─────────────────────────────────
        try:
            llm = get_gemini_client()
            llm_response = await llm.generate(
                user_message=intent,
                context_snippet=context_snippet,
                memory_snippet=memory_snippet,
            )
        except ValueError as cfg_err:
            # API key not configured — return a helpful error artifact
            logger.error("LLM not configured: %s", cfg_err)
            err_msg = "LLM is not configured. Set GOOGLE_API_KEY in the orchestrator environment."
            try:
                await backend.update_agent_task_status(
                    task_id=task.task_id, status="FAILED", error=err_msg
                )
            except Exception:
                pass
            return [A2AArtifact(
                name="crm_response",
                mime_type="application/json",
                content={"response": err_msg, "error": str(cfg_err), "session_id": session_id},
            )]
        except Exception as llm_err:
            logger.error("Gemini call failed: %s", llm_err)
            span.record_exception(llm_err)
            err_msg = "An error occurred while generating the response."
            try:
                await backend.update_agent_task_status(
                    task_id=task.task_id, status="FAILED", error=str(llm_err)
                )
            except Exception:
                pass
            return [A2AArtifact(
                name="crm_response",
                mime_type="application/json",
                content={"response": err_msg, "error": str(llm_err), "session_id": session_id},
            )]

        span.set_attribute("llm.response_length", len(llm_response))

        # ── 5b. Ensure response is A2UI JSON (fallback wrapper) ───────────
        # If Gemini ignored the JSON instruction, wrap the plain text in A2UI
        llm_response = _ensure_a2ui(llm_response)

        # ── 6. Output guardrails (PII redaction) ──────────────────────────
        output_check = await guardrails.validate_output(
            content=llm_response,
            session_id=session_id,
            agent_id="crm-orchestrator",
        )
        final_response = output_check.get("redacted_content") or llm_response
        span.set_attribute("guardrails.output_passed", output_check.get("passed", True))

        # ── 7. Persist conversation turns ──────────────────────────────────
        # conversationId is passed via task payload from the UI (highest priority),
        # then context_data, then falls back to session_id
        conversation_id = (
            (task.metadata.get("payload") or {}).get("conversationId")
            or task.metadata.get("conversationId")
            or context_data.get("conversationId")
            or session_id
        )
        # When a conversationId is provided (UI flow), the UI already saves the
        # user message before submitting the task — only save the agent reply to
        # avoid duplicates. Without a conversationId (direct API calls / tests),
        # save both turns so the conversation history is complete.
        ui_flow = bool((task.metadata.get("payload") or {}).get("conversationId"))
        try:
            if ui_flow:
                # Only persist the agent turn; user turn was saved by the UI
                await backend.append_message(
                    conversation_id=conversation_id,
                    role="agent",
                    content=final_response,
                    agent_id="crm-orchestrator",
                )
            else:
                await asyncio.gather(
                    backend.append_message(
                        conversation_id=conversation_id,
                        role="user",
                        content=intent,
                        agent_id="crm-orchestrator",
                    ),
                    backend.append_message(
                        conversation_id=conversation_id,
                        role="agent",
                        content=final_response,
                        agent_id="crm-orchestrator",
                    ),
                    return_exceptions=True,
                )
        except Exception as persist_err:
            span.record_exception(persist_err)
            logger.warning("Failed to persist conversation turns: %s", persist_err)

        # ── 7b. Notify backend that this task is COMPLETED ────────────────
        # The backend tracks tasks in its own Redis by taskId.  Without this
        # callback the task stays in SUBMITTED state and polling clients time out.
        try:
            await backend.update_agent_task_status(
                task_id=task.task_id,
                status="COMPLETED",
                result={
                    "response": final_response,
                    "context_available": bool(context_data),
                    "memories_used": len(memory_items),
                },
            )
        except Exception as cb_err:
            span.record_exception(cb_err)
            logger.warning("Task completion callback failed: %s", cb_err)

        # Compliance audit
        try:
            await backend.record_audit_event(
                event_type="AGENT_TASK_COMPLETED",
                action="orchestrator.llm_response",
                session_id=session_id,
                agent_id="crm-orchestrator",
                user_id=user_id,
                metadata={
                    "task_id": task.task_id,
                    "input_violations": len(input_check.get("violations", [])),
                    "output_redacted": final_response != llm_response,
                    "memory_results_used": len(memory_items),
                },
            )
        except Exception as audit_err:
            span.record_exception(audit_err)
            logger.warning("Audit event failed: %s", audit_err)

        # ── 8. Return artifacts ────────────────────────────────────────────
        return [
            A2AArtifact(
                name="crm_response",
                mime_type="application/json",
                content={
                    "response": final_response,
                    "session_id": session_id,
                    "context_available": bool(context_data),
                    "memories_used": len(memory_items),
                    "guardrails": {
                        "input_passed": input_check.get("passed", True),
                        "output_passed": output_check.get("passed", True),
                        "input_violations": len(input_check.get("violations", [])),
                    },
                },
            ),
            A2AArtifact(
                name="orchestration_metadata",
                mime_type="application/json",
                content={
                    "intent": intent,
                    "context_fields": list(context_data.keys()),
                    "memory_results_count": len(memory_items),
                    "model": settings.gemini_model,
                },
            ),
        ]


# ── FastAPI App ───────────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    setup_telemetry("crm-orchestrator")
    # Eagerly validate LLM config so failures appear at startup, not first request
    try:
        get_gemini_client()
        logger.info("Gemini LLM client ready (model=%s)", settings.gemini_model)
    except ValueError as e:
        logger.warning("Gemini LLM not configured: %s", e)
    yield


app = FastAPI(
    title="CRM Orchestrator Agent",
    version="0.2.0",
    lifespan=lifespan,
)

a2a_server = A2AServer(agent_card=ORCHESTRATOR_CARD, task_handler=handle_task)
a2a_server.mount(app)


@app.get("/health")
async def health():
    llm_ready = bool(settings.google_api_key)
    return {
        "status": "ok",
        "service": "crm-orchestrator",
        "llm": "gemini" if llm_ready else "not_configured",
        "model": settings.gemini_model if llm_ready else None,
    }


@app.get("/metrics")
async def metrics():
    return {"info": "metrics exported via OTLP"}
