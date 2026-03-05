"""
Perplexity research tool — calls Perplexity's sonar API for AI-powered
web research with citations. Acts as the grounding layer equivalent to the
Perplexity MCP server, returning structured results for LLM summarisation.

Priority models:
  1. sonar-pro        — deep research with rich citations (default)
  2. sonar            — faster, lighter research
  3. sonar-deep-research — comprehensive multi-step research (slower, higher cost)

Returns:
  {
    "query": str,
    "answer": str,             # Perplexity's synthesised answer
    "citations": [str, ...],   # source URLs
    "model": str,
  }
"""
from __future__ import annotations

import logging
from typing import Any

import httpx

from shared.config.settings import settings

logger = logging.getLogger(__name__)

_PERPLEXITY_URL = "https://api.perplexity.ai/chat/completions"

# System prompt that keeps Perplexity focused on factual, cited research
_RESEARCH_SYSTEM = (
    "You are an expert research assistant. Provide comprehensive, factual "
    "answers with specific data points, statistics, and named sources. "
    "Always cite your sources. For news topics, include publication dates. "
    "Be precise, objective, and thorough."
)


async def perplexity_research(
    query: str,
    model: str | None = None,
    max_tokens: int = 1024,
) -> dict[str, Any]:
    """
    Run a research query through Perplexity's sonar API.

    Returns a dict with keys: query, answer, citations, model, error (on failure).
    """
    if not settings.perplexity_api_key:
        logger.warning("PERPLEXITY_API_KEY not set — returning empty research result")
        return {
            "query": query,
            "answer": "",
            "citations": [],
            "model": "none",
            "error": "PERPLEXITY_API_KEY not configured",
        }

    chosen_model = model or settings.perplexity_model

    payload = {
        "model": chosen_model,
        "messages": [
            {"role": "system", "content": _RESEARCH_SYSTEM},
            {"role": "user",   "content": query},
        ],
        "max_tokens": max_tokens,
        "temperature": 0.2,
        "return_citations": True,
        "return_related_questions": False,
    }

    headers = {
        "Authorization": f"Bearer {settings.perplexity_api_key}",
        "Content-Type": "application/json",
    }

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(_PERPLEXITY_URL, json=payload, headers=headers)
            resp.raise_for_status()
            data = resp.json()

        answer = data.get("choices", [{}])[0].get("message", {}).get("content", "")
        # Citations are returned as a top-level list of URLs
        citations: list[str] = data.get("citations", [])

        logger.info(
            "Perplexity research completed: model=%s citations=%d answer_len=%d",
            chosen_model, len(citations), len(answer),
        )
        return {
            "query": query,
            "answer": answer,
            "citations": citations,
            "model": chosen_model,
        }

    except httpx.HTTPStatusError as e:
        logger.error(
            "Perplexity API error %s: %s",
            e.response.status_code, e.response.text[:300],
        )
        return {"query": query, "answer": "", "citations": [], "model": chosen_model,
                "error": f"HTTP {e.response.status_code}"}
    except Exception as e:
        logger.error("Perplexity request failed: %s", e)
        return {"query": query, "answer": "", "citations": [], "model": chosen_model,
                "error": str(e)}
