"""
PII Detection using Microsoft Presidio.
Detects emails, phone numbers, SSNs, credit cards, IP addresses, and more.
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Optional

try:
    from presidio_analyzer import AnalyzerEngine, RecognizerResult
    PRESIDIO_AVAILABLE = True
except ImportError:
    PRESIDIO_AVAILABLE = False

from shared.otel.setup import get_tracer

tracer = get_tracer("crm.guardrails.pii")


@dataclass
class PiiViolation:
    type: str
    severity: str   # LOW, MEDIUM, HIGH, CRITICAL
    start: int
    end: int
    detail: str
    score: float = 1.0


@dataclass
class PiiDetectionResult:
    passed: bool
    violations: list[PiiViolation] = field(default_factory=list)
    redacted_content: Optional[str] = None

    def has_critical_violation(self) -> bool:
        return any(v.severity == "CRITICAL" for v in self.violations)


# Severity mapping by Presidio entity type
_SEVERITY_MAP = {
    "CREDIT_CARD": "CRITICAL",
    "US_SSN": "CRITICAL",
    "US_BANK_NUMBER": "CRITICAL",
    "CRYPTO": "CRITICAL",
    "IBAN_CODE": "CRITICAL",
    "PHONE_NUMBER": "HIGH",
    "US_PASSPORT": "HIGH",
    "US_DRIVER_LICENSE": "HIGH",
    "EMAIL_ADDRESS": "MEDIUM",
    "IP_ADDRESS": "MEDIUM",
    "PERSON": "LOW",
    "LOCATION": "LOW",
    "DATE_TIME": "LOW",
    "NRP": "LOW",
}

# Fallback regex patterns when Presidio is not available
_FALLBACK_PATTERNS = [
    (re.compile(r'\b\d{3}-\d{2}-\d{4}\b'), "US_SSN", "CRITICAL"),
    (re.compile(r'\b(?:\d[ -]?){13,16}\b'), "CREDIT_CARD", "CRITICAL"),
    (re.compile(r'[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}'), "EMAIL_ADDRESS", "MEDIUM"),
    (re.compile(r'\b(?:\+1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b'), "PHONE_NUMBER", "HIGH"),
    (re.compile(r'\b(?:\d{1,3}\.){3}\d{1,3}\b'), "IP_ADDRESS", "MEDIUM"),
]


class PiiDetector:

    def __init__(self) -> None:
        self._analyzer: "AnalyzerEngine | None" = None
        if PRESIDIO_AVAILABLE:
            try:
                self._analyzer = AnalyzerEngine()
            except Exception:
                self._analyzer = None

    async def check(self, content: str) -> PiiDetectionResult:
        with tracer.start_as_current_span("guardrails.pii.check") as span:
            span.set_attribute("content.length", len(content))

            violations: list[PiiViolation] = []

            if self._analyzer:
                results: list["RecognizerResult"] = self._analyzer.analyze(
                    text=content, language="en"
                )
                for r in results:
                    entity = r.entity_type
                    severity = _SEVERITY_MAP.get(entity, "LOW")
                    violations.append(PiiViolation(
                        type=entity,
                        severity=severity,
                        start=r.start,
                        end=r.end,
                        detail=f"Detected {entity} (score={r.score:.2f})",
                        score=r.score,
                    ))
            else:
                # Fallback: regex-based detection
                for pattern, entity, severity in _FALLBACK_PATTERNS:
                    for m in pattern.finditer(content):
                        violations.append(PiiViolation(
                            type=entity,
                            severity=severity,
                            start=m.start(),
                            end=m.end(),
                            detail=f"Detected {entity} via pattern",
                        ))

            passed = len(violations) == 0
            redacted = self._redact(content, violations) if not passed else None

            span.set_attribute("guardrails.pii.passed", passed)
            span.set_attribute("guardrails.pii.violations", len(violations))

            return PiiDetectionResult(
                passed=passed,
                violations=violations,
                redacted_content=redacted,
            )

    def _redact(self, content: str, violations: list[PiiViolation]) -> str:
        """Replace detected PII spans with [REDACTED:TYPE]."""
        # Sort descending by start so replacements don't shift offsets
        sorted_violations = sorted(violations, key=lambda v: v.start, reverse=True)
        result = content
        for v in sorted_violations:
            result = result[:v.start] + f"[REDACTED:{v.type}]" + result[v.end:]
        return result
