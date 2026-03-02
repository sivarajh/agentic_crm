"""
OpenTelemetry initialization for CRM agent services.
Call setup_telemetry(service_name) at application startup.
"""
from opentelemetry import trace, metrics
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor
from opentelemetry.sdk.metrics import MeterProvider
from opentelemetry.sdk.metrics.export import PeriodicExportingMetricReader
from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import OTLPSpanExporter
from opentelemetry.exporter.otlp.proto.grpc.metric_exporter import OTLPMetricExporter
from opentelemetry.sdk.resources import Resource, SERVICE_NAME, SERVICE_VERSION
from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor
from opentelemetry.instrumentation.httpx import HTTPXClientInstrumentor

import logging
from shared.config.settings import settings

logger = logging.getLogger(__name__)

_tracer_provider: TracerProvider | None = None
_meter_provider: MeterProvider | None = None


def setup_telemetry(service_name: str, service_version: str = "0.1.0") -> None:
    """Initialize OTEL tracing and metrics. Call once at startup."""
    global _tracer_provider, _meter_provider

    otlp_endpoint = settings.otel_exporter_otlp_endpoint
    resource = Resource.create({
        SERVICE_NAME: service_name,
        SERVICE_VERSION: service_version,
        "deployment.environment": settings.environment,
    })

    # ─── Tracing ──────────────────────────────────────────────────────────────
    _tracer_provider = TracerProvider(resource=resource)
    _tracer_provider.add_span_processor(
        BatchSpanProcessor(
            OTLPSpanExporter(endpoint=otlp_endpoint, insecure=True)
        )
    )
    trace.set_tracer_provider(_tracer_provider)

    # ─── Metrics ──────────────────────────────────────────────────────────────
    metric_reader = PeriodicExportingMetricReader(
        OTLPMetricExporter(endpoint=otlp_endpoint, insecure=True),
        export_interval_millis=30_000,
    )
    _meter_provider = MeterProvider(resource=resource, metric_readers=[metric_reader])
    metrics.set_meter_provider(_meter_provider)

    # ─── Auto-instrument frameworks ───────────────────────────────────────────
    FastAPIInstrumentor().instrument()
    HTTPXClientInstrumentor().instrument()

    logger.info("OTEL setup complete: service=%s → %s", service_name, otlp_endpoint)


def get_tracer(name: str) -> trace.Tracer:
    return trace.get_tracer(name)


def get_meter(name: str) -> metrics.Meter:
    return metrics.get_meter(name)


def register_crm_metrics(meter: metrics.Meter) -> dict:
    """Register standard CRM agent metrics on a given meter."""
    return {
        "token_usage": meter.create_counter(
            "crm.agent.token_usage",
            unit="tokens",
            description="LLM token usage per agent invocation",
        ),
        "task_duration": meter.create_histogram(
            "crm.agent.task_duration_ms",
            unit="ms",
            description="Agent task execution duration in milliseconds",
        ),
        "memory_hit_rate": meter.create_up_down_counter(
            "crm.memory.hits",
            description="Memory cache hits vs misses",
        ),
        "task_success": meter.create_counter(
            "crm.agent.task_success",
            description="Count of successfully completed agent tasks",
        ),
        "task_failure": meter.create_counter(
            "crm.agent.task_failure",
            description="Count of failed agent tasks",
        ),
        "guardrail_violations": meter.create_counter(
            "crm.guardrails.violations",
            description="Count of guardrail violations by type",
        ),
    }
