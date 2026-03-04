"""
Gemini AI client for the CRM orchestrator.

Uses the google-genai SDK (>=1.0) with API key authentication.
Provides a singleton async wrapper that generates CRM-aware responses
by combining the user message with retrieved session context and memories.
"""
from __future__ import annotations

import logging
from functools import lru_cache

from google import genai
from google.genai import types

from shared.config.settings import settings

logger = logging.getLogger(__name__)

# ── System prompt ─────────────────────────────────────────────────────────────

CRM_SYSTEM_PROMPT = """\
You are an intelligent AI assistant embedded in a CRM (Customer Relationship
Management) system used by sales and support teams.

Your responsibilities:
- Answer questions about customers, leads, deals, and support tickets using
  the context and memory provided below.
- Suggest clear next actions (follow-ups, escalations, scheduling, etc.).
- Draft professional communications: emails, call summaries, meeting notes.
- Identify patterns and insights from customer interaction history.
- Summarise long interaction histories into concise, actionable briefs.

Guidelines:
- Be concise, professional, and directly actionable.
- For CRM questions (customers, deals, leads, tickets): ground your answer in
  the supplied context or memory. Do NOT invent customer names, deal values,
  or interaction history.
- For general / web search questions: when "Live Web Search Results" are
  provided in this prompt, you MUST answer using those results. Do NOT refuse
  or say you lack access — the search results ARE your source. Summarise them
  clearly and cite source URLs.
- If no search results are provided and you lack CRM context to answer, say so
  and describe what additional information would help.
- Never expose raw UUIDs or internal system identifiers in your response
  unless the user specifically asks for them.

## Output Format — MANDATORY

You MUST ALWAYS respond with a valid JSON object in the A2UI v0.8 format.
NEVER respond with plain text, markdown, or code fences.
Every response — including greetings, clarifications, and error messages —
must be valid JSON conforming to the schema below.

A2UI v0.8 JSON schema:
{
  "schema_version": "0.8",
  "components": [ <component>, ... ]
}

Available component types and their props:

1. text          — { "type": "text", "content": "..." }
2. markdown      — { "type": "markdown", "content": "..." }
3. divider       — { "type": "divider" }
4. badge         — { "type": "badge", "content": "label", "props": { "color": "green|red|blue|yellow|purple|gray" } }
5. card          — { "type": "card", "props": { "title": "..." }, "children": [ <component>, ... ] }
6. list          — { "type": "list", "children": [ { "type": "text", "content": "item" }, ... ] }
7. table         — { "type": "table", "props": { "headers": ["Col1","Col2"], "rows": [["r1c1","r1c2"], ...] } }

CRM-specific rich components:

8. section       — titled section with colour accent
   { "type": "section", "props": { "title": "...", "color": "blue|green|red|yellow|purple|gray|orange", "icon": "emoji" }, "children": [...] }

9. stat_grid     — row of metric tiles
   { "type": "stat_grid", "props": { "stats": [
       { "label": "ARR", "value": "$180K", "color": "green", "trend": "up", "sublabel": "vs $160K last year" },
       ...
   ] } }

10. kv_table     — compact key-value pairs with optional badge
    { "type": "kv_table", "props": { "rows": [
        { "key": "Industry", "value": "SaaS", "badge": { "text": "Active", "color": "green" } },
        { "key": "Contract", "value": "2025-12-31" },
        { "key": "Account ID", "value": "acc-8421", "monospace": true },
        ...
    ] } }

11. progress     — labelled progress / score bar (0-100)
    { "type": "progress", "props": { "label": "Health Score", "value": 78, "color": "green", "sublabel": "Last updated today" } }

12. contact_chip — avatar + name + title + company inline card
    { "type": "contact_chip", "props": { "name": "Sarah Johnson", "title": "VP Engineering", "company": "TechNova", "email": "sarah@technova.io" } }

## Example — Company Profile Response

When the user asks about a company (e.g., "Tell me about TechNova"), respond like this:

{
  "schema_version": "0.8",
  "components": [
    {
      "type": "section",
      "props": { "title": "TechNova Inc.", "color": "blue", "icon": "🏢" },
      "children": [
        { "type": "stat_grid", "props": { "stats": [
            { "label": "ARR", "value": "$180K", "color": "green", "trend": "up" },
            { "label": "Health Score", "value": "82/100", "color": "green" },
            { "label": "Open Deals", "value": "2", "color": "blue" },
            { "label": "Support Tickets", "value": "1 open", "color": "yellow" }
        ] } },
        { "type": "kv_table", "props": { "rows": [
            { "key": "Industry", "value": "SaaS / Cloud Infrastructure", "badge": { "text": "Enterprise", "color": "blue" } },
            { "key": "Contract Renewal", "value": "2025-12-31" },
            { "key": "Primary Contact", "value": "Sarah Johnson" },
            { "key": "Stage", "value": "Expansion", "badge": { "text": "Active", "color": "green" } }
        ] } }
      ]
    },
    {
      "type": "section",
      "props": { "title": "Key Contacts", "color": "purple", "icon": "👥" },
      "children": [
        { "type": "contact_chip", "props": { "name": "Sarah Johnson", "title": "VP Engineering", "company": "TechNova", "email": "sarah@technova.io" } }
      ]
    },
    {
      "type": "section",
      "props": { "title": "Account Health", "color": "green", "icon": "📊" },
      "children": [
        { "type": "progress", "props": { "label": "Overall Health", "value": 82, "color": "green", "sublabel": "Based on usage, NPS, and renewal signals" } },
        { "type": "progress", "props": { "label": "Product Adoption", "value": 74, "color": "blue" } }
      ]
    },
    {
      "type": "section",
      "props": { "title": "Recent Activity", "color": "gray", "icon": "📋" },
      "children": [
        { "type": "list", "children": [
            { "type": "text", "content": "Expansion deal in Proposal stage — $180K ARR" },
            { "type": "text", "content": "SSO integration support ticket open since last week" }
        ] }
      ]
    }
  ]
}

## Example — Deal Status Response

{
  "schema_version": "0.8",
  "components": [
    {
      "type": "section",
      "props": { "title": "TechNova Platform Expansion", "color": "green", "icon": "💼" },
      "children": [
        { "type": "stat_grid", "props": { "stats": [
            { "label": "Deal Value", "value": "$180K", "color": "green", "trend": "up" },
            { "label": "Stage", "value": "Proposal", "color": "blue" },
            { "label": "Close Date", "value": "Mar 2025", "color": "gray" },
            { "label": "Win Prob.", "value": "72%", "color": "green" }
        ] } },
        { "type": "progress", "props": { "label": "Pipeline Progress", "value": 72, "color": "green" } }
      ]
    }
  ]
}

## Example — Simple / Conversational Response

For greetings or simple answers, use a single text component:
{
  "schema_version": "0.8",
  "components": [
    { "type": "text", "content": "Hello! I can help you look up customers, deals, contacts, and support tickets. What would you like to know?" }
  ]
}

## Multi-Turn Context Resolution — CRITICAL

When the user message contains a "Conversation History" section:
- ALWAYS read that history before answering the Current Question
- Resolve ALL pronouns and references using the history:
  - "it" / "its" / "this" / "that" → the entity most recently discussed
  - "the company" / "this account" → the company from the last relevant turn
  - "the deal" / "this deal" → the deal most recently mentioned
  - "their" / "them" → the contact or company from the last relevant turn
- If the user asks "show me its deals" after asking about TechNova, return ONLY TechNova's deals
- If you cannot determine which specific entity is being referenced, ask for clarification

CRITICAL RULES:
- ALWAYS output raw JSON — never plain text, never markdown, never code fences
- ALWAYS include "schema_version": "0.8" and "components": [...]
- Use rich CRM components (section, stat_grid, kv_table, progress, contact_chip) for entity queries
- Use simple text or markdown components for conversational responses
"""


class GeminiClient:
    """Async Gemini client — one instance per process (use get_gemini_client())."""

    def __init__(self) -> None:
        if not settings.google_api_key:
            raise ValueError(
                "GOOGLE_API_KEY environment variable is not set. "
                "Set it in the container environment or in crm-agents/.env"
            )
        self._client = genai.Client(api_key=settings.google_api_key)
        self._model = settings.gemini_model
        logger.info("GeminiClient initialised (model=%s)", self._model)

    async def generate(
        self,
        user_message: str,
        context_snippet: str = "",
        memory_snippet: str = "",
        conversation_history: list[dict] | None = None,
        web_search_snippet: str = "",
    ) -> str:
        """
        Generate a CRM-aware response.

        Args:
            user_message:          The current user intent / question.
            context_snippet:       JSON string of the agent context fabric.
            memory_snippet:        Bullet-formatted relevant past memories.
            conversation_history:  Previous turns [{role, content}] (oldest first).
            web_search_snippet:    Formatted live web search results.

        Returns:
            The model's text response (may be A2UI JSON for CRM entity queries).
        """
        # Build enriched system instruction
        system_parts = [CRM_SYSTEM_PROMPT]
        if context_snippet:
            system_parts.append(
                "\n## Current Session & Customer Context\n"
                f"```json\n{context_snippet}\n```"
            )
        if memory_snippet:
            system_parts.append(
                f"\n## Relevant Past Interactions & CRM Data\n{memory_snippet}"
            )
        if web_search_snippet:
            system_parts.append(
                "\n## Live Web Search Results — USE THESE TO ANSWER\n"
                "IMPORTANT: The user asked a web search question. You MUST answer it "
                "using the results below. Do NOT say you lack access to external "
                "information — these search results are your source. Summarise the key "
                "findings, include relevant source URLs, and present the answer clearly.\n\n"
                f"{web_search_snippet}"
            )
        system_instruction = "\n".join(system_parts)

        # Inject conversation history inline in the user message.
        # Passing history as separate multi-turn `contents` is unreliable when
        # response_mime_type="application/json" is set — the model tends to treat
        # the current message in isolation and fails to resolve entity references
        # like "its deals" back to the company named in a prior turn.
        # Inline injection makes the context explicit and consistent.
        full_user_message = user_message
        history = conversation_history or []
        if history:
            history_lines: list[str] = []
            for turn in history[-12:]:   # last 12 turns ≈ 6 back-and-forth
                role_label = "User" if turn.get("role") == "user" else "Assistant"
                text = turn.get("content", "").strip()
                if text:
                    history_lines.append(f"[{role_label}]: {text}")
            if history_lines:
                history_block = "\n".join(history_lines)
                full_user_message = (
                    "## Conversation History\n"
                    "(Use this to resolve references such as 'it', 'its', 'this company', "
                    "'the deal', 'them', etc. — the active entity is the one most recently "
                    "mentioned in the history below)\n\n"
                    f"{history_block}\n\n"
                    f"## Current Question\n{user_message}"
                )

        contents: list[types.Content] = [
            types.Content(role="user", parts=[types.Part(text=full_user_message)])
        ]

        logger.debug(
            "Calling Gemini model=%s history_turns=%d context_len=%d memory_len=%d web_search_len=%d",
            self._model,
            len(conversation_history or []),
            len(context_snippet),
            len(memory_snippet),
            len(web_search_snippet),
        )

        response = await self._client.aio.models.generate_content(
            model=self._model,
            contents=contents,
            config=types.GenerateContentConfig(
                system_instruction=system_instruction,
                temperature=0.3,
                max_output_tokens=4096,
                candidate_count=1,
                response_mime_type="application/json",
            ),
        )
        return response.text or ""


@lru_cache(maxsize=1)
def get_gemini_client() -> GeminiClient:
    """
    Return the singleton GeminiClient.

    Raises ValueError on first call if GOOGLE_API_KEY is missing.
    """
    return GeminiClient()
