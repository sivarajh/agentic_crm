"""
Central Guardrails Engine — orchestrates all input and output checks.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Optional

from guardrails.input_guardrails.pii_detector import PiiDetector, PiiViolation
from guardrails.input_guardrails.prompt_injection_detector import (
    PromptInjectionDetector, InjectionViolation
)
from shared.config.settings import settings
from shared.otel.setup import get_tracer

tracer = get_tracer("crm.guardrails.engine")


@dataclass
class Violation:
    type: str          # PII_DETECTED, PROMPT_INJECTION, TOXICITY, etc.
    severity: str      # LOW, MEDIUM, HIGH, CRITICAL
    detail: str
    metadata: dict = field(default_factory=dict)


@dataclass
class GuardrailResult:
    passed: bool
    violations: list[Violation] = field(default_factory=list)
    redacted_content: Optional[str] = None
    schema_valid: bool = True

    def has_critical_violation(self) -> bool:
        return any(v.severity == "CRITICAL" for v in self.violations)

    def requires_human_review(self) -> bool:
        return any(v.severity in ("CRITICAL", "HIGH") for v in self.violations)


class GuardrailsEngine:

    def __init__(self) -> None:
        self.pii_detector = PiiDetector()
        self.injection_detector = PromptInjectionDetector()

    async def validate_input(
        self,
        content: str,
        session_id: str | None = None,
        user_id: str | None = None,
        agent_id: str | None = None,
        context: dict | None = None,
    ) -> GuardrailResult:
        with tracer.start_as_current_span("guardrails.input") as span:
            span.set_attribute("agent.id", agent_id or "")
            span.set_attribute("session.id", session_id or "")

            all_violations: list[Violation] = []
            redacted = content

            # PII detection
            if settings.guardrails_pii_enabled:
                pii_result = await self.pii_detector.check(content)
                if not pii_result.passed:
                    for v in pii_result.violations:
                        all_violations.append(Violation(
                            type="PII_DETECTED",
                            severity=v.severity,
                            detail=v.detail,
                            metadata={"entity_type": v.type},
                        ))
                    if pii_result.redacted_content:
                        redacted = pii_result.redacted_content

            # Prompt injection detection
            if settings.guardrails_injection_enabled:
                inj_result = await self.injection_detector.check(content)
                if not inj_result.passed:
                    for v in inj_result.violations:
                        all_violations.append(Violation(
                            type="PROMPT_INJECTION",
                            severity=v.severity,
                            detail=v.detail,
                        ))

            passed = len(all_violations) == 0
            span.set_attribute("guardrails.passed", passed)

            return GuardrailResult(
                passed=passed,
                violations=all_violations,
                redacted_content=redacted if not passed else None,
            )

    async def validate_output(
        self,
        content: str,
        schema: dict | None = None,
        session_id: str | None = None,
        agent_id: str | None = None,
    ) -> GuardrailResult:
        with tracer.start_as_current_span("guardrails.output") as span:
            span.set_attribute("agent.id", agent_id or "")

            all_violations: list[Violation] = []
            redacted = content

            # PII redaction on output (respects settings)
            if settings.guardrails_pii_enabled:
                pii_result = await self.pii_detector.check(content)
                if not pii_result.passed:
                    for v in pii_result.violations:
                        all_violations.append(Violation(
                            type="OUTPUT_PII_DETECTED",
                            severity=v.severity,
                            detail=v.detail,
                            metadata={"entity_type": v.type},
                        ))
                    if pii_result.redacted_content:
                        redacted = pii_result.redacted_content

            schema_valid = True
            if schema:
                schema_valid = self._validate_schema(content, schema)
                if not schema_valid:
                    all_violations.append(Violation(
                        type="SCHEMA_VIOLATION",
                        severity="MEDIUM",
                        detail="Output does not match expected schema",
                    ))

            passed = len(all_violations) == 0
            span.set_attribute("guardrails.passed", passed)

            return GuardrailResult(
                passed=passed,
                violations=all_violations,
                redacted_content=redacted if not passed else None,
                schema_valid=schema_valid,
            )

    def _validate_schema(self, content: str, schema: dict) -> bool:
        """Basic schema validation — extend with jsonschema for production."""
        import json
        try:
            data = json.loads(content)
            required = schema.get("required", [])
            if isinstance(data, dict):
                return all(k in data for k in required)
            return True
        except (json.JSONDecodeError, Exception):
            return False
