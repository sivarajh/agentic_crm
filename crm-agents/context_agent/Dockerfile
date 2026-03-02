FROM python:3.12-slim AS builder

WORKDIR /app
RUN pip install --no-cache-dir uv
COPY pyproject.toml uv.lock* ./
RUN uv sync --no-dev --no-install-project

# ─── Runtime ──────────────────────────────────────────────────────────────────
FROM python:3.12-slim

WORKDIR /app

COPY --from=builder /app/.venv /app/.venv
COPY shared/ ./shared/
COPY context_agent/ ./context_agent/

ENV PATH="/app/.venv/bin:$PATH"
ENV PYTHONPATH="/app"
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

EXPOSE 8003

CMD ["uvicorn", "context_agent.agent:app", "--host", "0.0.0.0", "--port", "8003", "--log-level", "info"]
