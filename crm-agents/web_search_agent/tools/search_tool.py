"""
Web search tool — uses Google Custom Search JSON API (primary) with DuckDuckGo as fallback.

Priority:
  1. Google Custom Search API (if GOOGLE_API_KEY + GOOGLE_CSE_ID are set)
  2. DuckDuckGo (free, no key required)

Returns a list of dicts: { title, url, snippet }
"""
from __future__ import annotations

import logging
from typing import Any

import httpx

from shared.config.settings import settings

logger = logging.getLogger(__name__)

_GOOGLE_SEARCH_URL = "https://www.googleapis.com/customsearch/v1"


async def web_search(query: str, max_results: int = 6) -> list[dict[str, Any]]:
    """Search the web and return structured results."""
    if settings.google_api_key and settings.google_cse_id:
        results = await _google_search(query, max_results)
        if results:
            return results
        logger.warning("Google Custom Search returned no results, falling back to DuckDuckGo")
    return await _ddg_search(query, max_results)


async def _google_search(query: str, max_results: int) -> list[dict[str, Any]]:
    """Google Custom Search JSON API — uses GOOGLE_API_KEY + GOOGLE_CSE_ID."""
    try:
        params = {
            "key": settings.google_api_key,
            "cx": settings.google_cse_id,
            "q": query,
            "num": min(max_results, 10),   # Google CSE max per request is 10
        }
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.get(_GOOGLE_SEARCH_URL, params=params)
            resp.raise_for_status()
            data = resp.json()

        return [
            {
                "title": item.get("title", ""),
                "url": item.get("link", ""),
                "snippet": item.get("snippet", ""),
            }
            for item in data.get("items", [])
        ]
    except httpx.HTTPStatusError as e:
        logger.error("Google Custom Search API error %s: %s", e.response.status_code, e.response.text[:200])
        return []
    except Exception as e:
        logger.error("Google Custom Search failed: %s", e)
        return []


async def _ddg_search(query: str, max_results: int) -> list[dict[str, Any]]:
    """DuckDuckGo search — free fallback, no API key required."""
    import asyncio

    def _sync_search() -> list[dict[str, Any]]:
        from ddgs import DDGS
        results: list[dict[str, Any]] = []
        with DDGS() as ddgs:
            for r in ddgs.text(query, max_results=max_results):
                results.append({
                    "title": r.get("title", ""),
                    "url": r.get("href", ""),
                    "snippet": r.get("body", ""),
                })
        return results

    try:
        return await asyncio.to_thread(_sync_search)
    except Exception as e:
        logger.error("DuckDuckGo search failed: %s", e)
        return []
