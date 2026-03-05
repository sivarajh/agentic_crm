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
import re
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

# ── Web-search intent detector ────────────────────────────────────────────────

_WEB_SEARCH_RE = re.compile(
    r'\b(search the web|google|web search|internet|online|'
    r'stock price|weather|'
    r'what is|who is|how does|when did|where is|'
    r'trending|breaking)\b',
    re.I,
)

_RESEARCH_RE = re.compile(
    r'\b(news|latest|current events|today|recent|'
    r'research|analyze|analyse|deep dive|comprehensive|in.?depth|'
    r'developments|market analysis|trends|'
    r'report|findings|study|survey|statistics|data on|'
    r'fact.?check|verify|is it true|what happened|'
    r'tell me about|explain|overview of|summary of)\b',
    re.I,
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

def _extract_text_from_a2ui(content: str) -> str:
    """
    Convert an A2UI JSON agent message into a compact plain-text summary
    suitable for inclusion in Gemini's conversation history.

    This prevents token bloat and makes the history readable to the model.
    Falls back to the raw content if parsing fails.
    """
    try:
        parsed = json.loads(content)
    except (json.JSONDecodeError, ValueError):
        return content[:500]

    if not isinstance(parsed, dict) or "components" not in parsed:
        return content[:500]

    texts: list[str] = []

    def _collect(components: list) -> None:
        for comp in components:
            ctype = comp.get("type", "")
            props = comp.get("props") or {}

            if ctype in ("text", "markdown") and comp.get("content"):
                texts.append(str(comp["content"])[:300])

            elif ctype == "section":
                title = props.get("title", "")
                if title:
                    texts.append(f"[{title}]")
                _collect(comp.get("children") or [])

            elif ctype == "stat_grid":
                for stat in props.get("stats") or []:
                    if stat.get("label") and stat.get("value"):
                        texts.append(f"{stat['label']}: {stat['value']}")

            elif ctype == "kv_table":
                for row in props.get("rows") or []:
                    if row.get("key") and row.get("value"):
                        texts.append(f"{row['key']}: {row['value']}")

            elif ctype == "progress":
                label = props.get("label", "")
                value = props.get("value", "")
                if label:
                    texts.append(f"{label}: {value}%")

            elif ctype == "contact_chip":
                parts = [
                    props.get("name", ""),
                    props.get("title", ""),
                    props.get("company", ""),
                ]
                summary = " – ".join(p for p in parts if p)
                if summary:
                    texts.append(summary)

            # recurse into generic children
            _collect(comp.get("children") or [])

    _collect(parsed["components"])
    result = " | ".join(texts[:12])   # cap at 12 snippets to stay concise
    return result or content[:300]


def _build_gemini_history(raw_messages: list[dict]) -> list[dict]:
    """
    Convert backend conversation messages → Gemini-compatible history list.

    - user  → role="user"
    - agent → role="model", content extracted from A2UI JSON to plain text
    Excludes the last message (current turn) — the caller appends that.
    """
    history: list[dict] = []
    for msg in raw_messages:
        role = msg.get("role", "")
        content = msg.get("content", "").strip()
        if not content:
            continue
        if role == "user":
            history.append({"role": "user", "content": content})
        elif role in ("agent", "model", "assistant"):
            history.append({
                "role": "model",
                "content": _extract_text_from_a2ui(content),
            })
    return history


async def _empty_list() -> list:
    """Async no-op that returns an empty list — used as a gather placeholder."""
    return []


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

        # ── 3. Fetch context + memories + conversation history in parallel ──
        sub_metadata: dict[str, Any] = {
            "session_id": session_id,
            "orchestrator_task_id": task.task_id,
            "userId": user_id,
            "agentId": "crm-orchestrator",
            "contextId": session_id,
            **task.metadata,
        }

        # conversationId from UI payload enables history fetch
        conv_id_for_history: str | None = (
            (task.metadata.get("payload") or {}).get("conversationId")
        )

        # Determine whether intent requires real-time web search
        needs_web_search = bool(_WEB_SEARCH_RE.search(intent))
        needs_research   = bool(_RESEARCH_RE.search(intent))

        context_result, memory_result, raw_history, web_search_result, research_result = await asyncio.gather(
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
            # Fetch recent conversation turns for history grounding.
            # We cap at 20 messages (10 user + 10 agent) to stay within
            # a reasonable token budget while giving the model enough
            # context to resolve pronouns and entity references.
            backend.get_conversation_messages(conv_id_for_history, limit=20)
            if conv_id_for_history
            else _empty_list(),
            # Only call web search agent when the intent signals external knowledge need
            task_manager.delegate(
                "crm-web-search-agent",
                session_id,
                intent,
                {**sub_metadata, "skill_id": "web_search"},
            )
            if needs_web_search
            else _empty_list(),
            # Deep research via Perplexity sonar when intent signals analytical need
            task_manager.delegate(
                "crm-news-research-agent",
                session_id,
                intent,
                {**sub_metadata, "skill_id": "research"},
            )
            if needs_research
            else _empty_list(),
            return_exceptions=True,
        )

        context_data = _extract_artifact(context_result, "agent_context")
        memory_data = _extract_artifact(memory_result, "semantic_search_results")
        memory_items: list[dict] = memory_data.get("results", [])
        web_search_data = _extract_artifact(web_search_result, "web_search_results") if needs_web_search else {}
        research_data   = _extract_artifact(research_result, "research_results")   if needs_research   else {}

        # Build conversation history for Gemini — exclude the current user
        # turn (it's passed separately as `user_message`).
        if isinstance(raw_history, list) and raw_history:
            # Drop the last message if it's the user's current turn
            # (the UI already saved it before submitting the task)
            history_msgs = raw_history[:-1] if raw_history[-1].get("role") == "user" else raw_history
            conversation_history = _build_gemini_history(history_msgs)
        else:
            conversation_history = []

        span.set_attribute("context.fields_count", len(context_data))
        span.set_attribute("memory.results_count", len(memory_items))
        span.set_attribute("history.turns_count", len(conversation_history))
        span.set_attribute("web_search.used", needs_web_search)
        span.set_attribute("research.used", needs_research)

        # ── 4. Build context / memory / web-search snippets for the prompt ─
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

        # Format web search results as numbered list with title + URL + snippet
        web_search_lines: list[str] = []
        for i, r in enumerate(web_search_data.get("results", [])[:6], start=1):
            title = r.get("title", "").strip()
            url = r.get("url", "").strip()
            snippet = r.get("snippet", "").strip()[:400]
            if title or snippet:
                web_search_lines.append(f"{i}. **{title}**\n   URL: {url}\n   {snippet}")
        web_search_snippet = "\n\n".join(web_search_lines)

        if needs_web_search:
            span.set_attribute("web_search.results_count", len(web_search_data.get("results", [])))

        # Format Perplexity research as answer + numbered citations
        research_answer    = research_data.get("answer", "").strip()
        research_citations = research_data.get("citations", [])
        research_model     = research_data.get("model", "")
        research_snippet   = ""
        if research_answer:
            citation_lines = [
                f"[{i}] {url}" for i, url in enumerate(research_citations[:8], start=1)
            ]
            citations_block = "\n".join(citation_lines) if citation_lines else ""
            research_snippet = (
                f"Research summary (via Perplexity {research_model}):\n"
                f"{research_answer[:2000]}"
                + (f"\n\nSources:\n{citations_block}" if citations_block else "")
            )
        if needs_research:
            span.set_attribute("research.answer_len", len(research_answer))
            span.set_attribute("research.citations_count", len(research_citations))

        logger.debug(
            "Context ready: context_fields=%d memory_items=%d history_turns=%d web_results=%d research_len=%d",
            len(context_data), len(memory_items), len(conversation_history),
            len(web_search_data.get("results", [])), len(research_answer) if needs_research else 0,
        )

        # ── 5. LLM: generate CRM response (streaming) ─────────────────────
        try:
            llm = get_gemini_client()
            chunks: list[str] = []
            push_tasks: list[asyncio.Task] = []
            async for chunk in llm.generate_stream(
                user_message=intent,
                context_snippet=context_snippet,
                memory_snippet=memory_snippet,
                conversation_history=conversation_history,
                web_search_snippet=web_search_snippet,
                research_snippet=research_snippet,
            ):
                chunks.append(chunk)
                # Fire-and-forget: push each chunk without blocking the stream
                push_tasks.append(asyncio.create_task(
                    backend.push_stream_event(
                        task.task_id, "agent.message", {"content": chunk}
                    )
                ))
            # Wait for all pushes to complete (most already have by now)
            if push_tasks:
                await asyncio.gather(*push_tasks, return_exceptions=True)
            llm_response = "".join(chunks)
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
                    "web_search_used": needs_web_search,
                    "web_search_results_count": len(web_search_data.get("results", [])),
                    "research_used": needs_research,
                    "research_citations_count": len(research_citations),
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
