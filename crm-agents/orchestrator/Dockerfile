# Multi-stage: install deps with uv → minimal runtime image
FROM python:3.12-slim AS builder

WORKDIR /app

# Install uv
RUN pip install --no-cache-dir uv

# Copy dependency files
COPY pyproject.toml uv.lock* ./
# Install all runtime deps into an isolated venv
RUN uv sync --no-dev --no-install-project

# ─── Runtime ──────────────────────────────────────────────────────────────────
FROM python:3.12-slim

WORKDIR /app

# Copy the virtualenv from builder
COPY --from=builder /app/.venv /app/.venv

# Copy application source
COPY shared/ ./shared/
COPY orchestrator/ ./orchestrator/

ENV PATH="/app/.venv/bin:$PATH"
ENV PYTHONPATH="/app"
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

EXPOSE 8001

CMD ["uvicorn", "orchestrator.agent:app", "--host", "0.0.0.0", "--port", "8001", "--log-level", "info"]
