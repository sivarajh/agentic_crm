"""
Guardrails FastAPI service — exposes validation endpoints for the backend
and other services.
"""
from __future__ import annotations

from contextlib import asynccontextmanager
from typing import Any, Optional

from fastapi import FastAPI
from pydantic import BaseModel

from guardrails.engine import GuardrailsEngine, GuardrailResult, Violation
from shared.otel.setup import setup_telemetry

engine = GuardrailsEngine()


@asynccontextmanager
async def lifespan(app: FastAPI):
    setup_telemetry("crm-guardrails")
    yield


app = FastAPI(
    title="CRM Guardrails Service",
    version="0.1.0",
    lifespan=lifespan,
)


class InputValidationRequest(BaseModel):
    content: str
    session_id: Optional[str] = None
    user_id: Optional[str] = None
    agent_id: Optional[str] = None
    context: Optional[dict] = None


class OutputValidationRequest(BaseModel):
    content: str
    schema: Optional[dict] = None
    session_id: Optional[str] = None
    agent_id: Optional[str] = None


class ViolationResponse(BaseModel):
    type: str
    severity: str
    detail: str
    metadata: dict = {}


class ValidationResponse(BaseModel):
    passed: bool
    violations: list[ViolationResponse]
    redacted_content: Optional[str] = None
    schema_valid: bool = True


@app.post("/guardrails/validate/input", response_model=ValidationResponse)
async def validate_input(request: InputValidationRequest):
    result = await engine.validate_input(
        content=request.content,
        session_id=request.session_id,
        user_id=request.user_id,
        agent_id=request.agent_id,
        context=request.context,
    )
    return _to_response(result)


@app.post("/guardrails/validate/output", response_model=ValidationResponse)
async def validate_output(request: OutputValidationRequest):
    result = await engine.validate_output(
        content=request.content,
        schema=request.schema,
        session_id=request.session_id,
        agent_id=request.agent_id,
    )
    return _to_response(result)


@app.get("/health")
async def health():
    return {"status": "ok", "service": "crm-guardrails"}


@app.get("/metrics")
async def metrics():
    # Prometheus metrics are scraped from OTEL collector
    return {"info": "metrics exported via OTLP"}


def _to_response(result: GuardrailResult) -> ValidationResponse:
    return ValidationResponse(
        passed=result.passed,
        violations=[
            ViolationResponse(type=v.type, severity=v.severity,
                              detail=v.detail, metadata=v.metadata)
            for v in result.violations
        ],
        redacted_content=result.redacted_content,
        schema_valid=result.schema_valid,
    )
