"""
Central configuration for all CRM agent services.
Values are loaded from environment variables (or .env file for local dev).
"""
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # ─── Service Identity ────────────────────────────────────────────────────
    environment: str = Field(default="local")

    # ─── Google / Gemini ─────────────────────────────────────────────────────
    google_cloud_project: str = Field(default="")
    google_cloud_location: str = Field(default="us-central1")
    gemini_model: str = Field(default="gemini-2.5-flash")
    google_api_key: str = Field(default="")           # alternative to ADC

    # ─── Backend (crm-backend) ───────────────────────────────────────────────
    backend_url: str = Field(default="http://localhost:8080")
    backend_timeout_s: int = Field(default=30)

    # ─── Agent URLs (for inter-agent A2A calls) ──────────────────────────────
    orchestrator_url: str = Field(default="http://localhost:8001")
    memory_agent_url: str = Field(default="http://localhost:8002")
    context_agent_url: str = Field(default="http://localhost:8003")
    guardrails_url: str = Field(default="http://localhost:8004")
    web_search_agent_url: str = Field(default="http://localhost:8005")

    # ─── Redis ───────────────────────────────────────────────────────────────
    redis_host: str = Field(default="localhost")
    redis_port: int = Field(default=6379)
    redis_password: str = Field(default="")
    redis_db: int = Field(default=0)

    # ─── Qdrant ──────────────────────────────────────────────────────────────
    qdrant_host: str = Field(default="localhost")
    qdrant_port: int = Field(default=6333)         # REST port
    qdrant_grpc_port: int = Field(default=6334)    # gRPC port
    qdrant_api_key: str = Field(default="")
    qdrant_semantic_collection: str = Field(default="crm_semantic")
    qdrant_episodic_collection: str = Field(default="crm_episodic_embeddings")
    qdrant_embedding_size: int = Field(default=768)

    # ─── OTEL ────────────────────────────────────────────────────────────────
    otel_exporter_otlp_endpoint: str = Field(default="http://localhost:4317")

    # ─── Guardrails ──────────────────────────────────────────────────────────
    guardrails_pii_enabled: bool = Field(default=False)
    guardrails_injection_enabled: bool = Field(default=True)
    guardrails_toxicity_enabled: bool = Field(default=True)

    # ─── Memory ──────────────────────────────────────────────────────────────
    working_memory_ttl_minutes: int = Field(default=30)
    episodic_recent_limit: int = Field(default=10)

    # ─── Web Search ──────────────────────────────────────────────────────────
    # Google Custom Search Engine ID (https://programmablesearchengine.google.com)
    # Uses the existing GOOGLE_API_KEY. Falls back to DuckDuckGo if not set.
    google_cse_id: str = Field(default="")

    # ─── News & Research (Perplexity) ────────────────────────────────────────
    # Perplexity API key — get one at https://www.perplexity.ai/settings/api
    # Models: sonar (fast) | sonar-pro (deep, default) | sonar-deep-research (comprehensive)
    perplexity_api_key: str = Field(default="")
    perplexity_model: str = Field(default="sonar-pro")
    news_research_agent_url: str = Field(default="http://localhost:8006")

    # ─── Auth ────────────────────────────────────────────────────────────────
    internal_api_key: str = Field(default="crm-internal-dev-key")


# Singleton instance
settings = Settings()
