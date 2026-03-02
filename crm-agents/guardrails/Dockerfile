FROM python:3.12-slim AS builder

WORKDIR /app
RUN pip install --no-cache-dir uv
COPY pyproject.toml uv.lock* ./
RUN uv sync --no-dev --no-install-project

# uv venvs are created without pip by default; add it so spacy's download
# command (which shells out to pip internally) can fetch the model wheel.
RUN uv pip install --python /app/.venv pip
# Pre-download Presidio NLP model during build (avoids cold-start delay)
RUN /app/.venv/bin/python -m spacy download en_core_web_lg

# ─── Runtime ──────────────────────────────────────────────────────────────────
FROM python:3.12-slim

WORKDIR /app

COPY --from=builder /app/.venv /app/.venv
# en_core_web_lg is installed inside .venv (not /root/.local), so no extra COPY needed
COPY shared/ ./shared/
COPY guardrails/ ./guardrails/

ENV PATH="/app/.venv/bin:$PATH"
ENV PYTHONPATH="/app"
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

EXPOSE 8004

CMD ["uvicorn", "guardrails.api:app", "--host", "0.0.0.0", "--port", "8004", "--log-level", "info"]
