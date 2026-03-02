"""
Prompt injection detection.
Heuristic patterns + keyword scanning for common injection attacks.
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field

from shared.otel.setup import get_tracer

tracer = get_tracer("crm.guardrails.injection")

# Common prompt injection patterns
_INJECTION_PATTERNS = [
    re.compile(r'ignore\s+(all\s+)?previous\s+instructions?', re.IGNORECASE),
    re.compile(r'disregard\s+(all\s+)?previous\s+instructions?', re.IGNORECASE),
    re.compile(r'forget\s+(all\s+)?previous\s+instructions?', re.IGNORECASE),
    re.compile(r'you\s+are\s+now\s+(?:a\s+)?(?:different|new)\s+(?:ai|model|assistant)', re.IGNORECASE),
    re.compile(r'act\s+as\s+(?:if\s+you\s+are\s+)?(?:an?\s+)?(?:evil|malicious|unrestricted)', re.IGNORECASE),
    re.compile(r'jailbreak', re.IGNORECASE),
    re.compile(r'dan\s+mode', re.IGNORECASE),  # DAN (Do Anything Now)
    re.compile(r'override\s+(?:safety|security|content)\s+(?:filter|guard|check)', re.IGNORECASE),
    re.compile(r'system\s*:\s*you\s+are', re.IGNORECASE),
    re.compile(r'<\s*system\s*>', re.IGNORECASE),
    re.compile(r'\[INST\]', re.IGNORECASE),    # Llama instruction injection
    re.compile(r'###\s*(?:instruction|system|prompt)', re.IGNORECASE),
    re.compile(r'print\s+(?:your\s+)?(?:system\s+)?prompt', re.IGNORECASE),
    re.compile(r'reveal\s+(?:your\s+)?(?:hidden\s+)?instructions?', re.IGNORECASE),
]


@dataclass
class InjectionViolation:
    pattern: str
    severity: str = "HIGH"
    detail: str = ""
    position: int = -1


@dataclass
class InjectionDetectionResult:
    passed: bool
    violations: list[InjectionViolation] = field(default_factory=list)

    def has_critical_violation(self) -> bool:
        return any(v.severity == "CRITICAL" for v in self.violations)


class PromptInjectionDetector:

    async def check(self, content: str) -> InjectionDetectionResult:
        with tracer.start_as_current_span("guardrails.injection.check") as span:
            span.set_attribute("content.length", len(content))

            violations: list[InjectionViolation] = []
            for pattern in _INJECTION_PATTERNS:
                match = pattern.search(content)
                if match:
                    violations.append(InjectionViolation(
                        pattern=pattern.pattern,
                        severity="HIGH",
                        detail=f"Injection pattern matched: '{match.group()}'",
                        position=match.start(),
                    ))

            passed = len(violations) == 0
            span.set_attribute("guardrails.injection.passed", passed)
            span.set_attribute("guardrails.injection.violations", len(violations))

            return InjectionDetectionResult(passed=passed, violations=violations)
