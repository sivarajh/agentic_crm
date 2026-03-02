"""
Semantic Memory tool — vector search and upsert via Qdrant + Gemini embeddings.

Uses Gemini text-embedding-001 (768-dim, Matryoshka) directly instead of
routing through the backend, eliminating the missing /api/v1/memory/semantic/*
endpoints dependency.
"""
from __future__ import annotations

import logging
import uuid

import google.genai as genai
from google.genai import types as gtypes
from qdrant_client import QdrantClient
from qdrant_client.models import Filter, FieldCondition, MatchValue, PointStruct

from shared.config.settings import settings

logger = logging.getLogger(__name__)

# ── Singletons ────────────────────────────────────────────────────────────────

_genai_client: genai.Client | None = None
_qdrant_client: QdrantClient | None = None

EMBED_MODEL = "models/gemini-embedding-001"
EMBED_DIMS  = settings.qdrant_embedding_size  # 768


def _genai() -> genai.Client:
    global _genai_client
    if _genai_client is None:
        _genai_client = genai.Client()
    return _genai_client


def _qdrant() -> QdrantClient:
    global _qdrant_client
    if _qdrant_client is None:
        _qdrant_client = QdrantClient(
            host=settings.qdrant_host,
            port=settings.qdrant_port,
            check_compatibility=False,
        )
    return _qdrant_client


# ── Embedding ─────────────────────────────────────────────────────────────────

def _embed(text: str) -> list[float]:
    """Generate a 768-dim embedding via Gemini."""
    result = _genai().models.embed_content(
        model=EMBED_MODEL,
        contents=text,
        config=gtypes.EmbedContentConfig(output_dimensionality=EMBED_DIMS),
    )
    return list(result.embeddings[0].values)


# ── Public API ────────────────────────────────────────────────────────────────

async def semantic_search(
    query: str,
    entity_type: str | None = None,
    top_k: int = 5,
    score_threshold: float = 0.55,
) -> list[dict]:
    """
    Perform cosine-similarity search in Qdrant.

    Returns a list of dicts, each containing:
      - score (float)
      - payload (dict with 'content', 'entity_type', 'entity_id', ...)
    """
    try:
        vector = _embed(query)

        # Build optional entity_type filter
        qdrant_filter: Filter | None = None
        if entity_type:
            qdrant_filter = Filter(
                must=[FieldCondition(key="entity_type", match=MatchValue(value=entity_type))]
            )

        # qdrant-client >= 1.10 uses query_points; older versions use search
        try:
            response = _qdrant().query_points(
                collection_name=settings.qdrant_semantic_collection,
                query=vector,
                limit=top_k,
                score_threshold=score_threshold,
                query_filter=qdrant_filter,
                with_payload=True,
            )
            hits = response.points
        except AttributeError:
            # Fallback for older qdrant-client
            hits = _qdrant().search(  # type: ignore[attr-defined]
                collection_name=settings.qdrant_semantic_collection,
                query_vector=vector,
                limit=top_k,
                score_threshold=score_threshold,
                query_filter=qdrant_filter,
                with_payload=True,
            )

        return [
            {"score": hit.score, "payload": hit.payload or {}}
            for hit in hits
        ]

    except Exception as exc:
        logger.warning("Semantic search failed: %s", exc)
        return []


async def upsert_semantic_memory(
    content: str,
    entity_id: str,
    entity_type: str,
    metadata: dict | None = None,
) -> dict:
    """
    Vectorise `content` with Gemini and upsert into Qdrant.
    Uses a deterministic UUID derived from entity_id + content to enable dedup.
    """
    try:
        vector = _embed(content)
        point_id = str(uuid.uuid5(uuid.NAMESPACE_DNS, f"{entity_type}:{entity_id}:{content[:64]}"))

        payload = {
            "entity_id": entity_id,
            "entity_type": entity_type,
            "source_agent": "crm-memory-agent",
            "content": content,
            **(metadata or {}),
        }

        _qdrant().upsert(
            collection_name=settings.qdrant_semantic_collection,
            points=[PointStruct(id=point_id, vector=vector, payload=payload)],
        )
        logger.info("Upserted semantic memory point %s for %s/%s", point_id, entity_type, entity_id)
        return {"status": "stored", "point_id": point_id, "entity_id": entity_id}

    except Exception as exc:
        logger.error("Semantic memory upsert failed: %s", exc)
        return {"status": "error", "error": str(exc)}
