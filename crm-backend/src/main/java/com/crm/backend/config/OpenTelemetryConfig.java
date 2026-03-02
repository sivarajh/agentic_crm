package com.crm.backend.config;

import io.opentelemetry.api.OpenTelemetry;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * OpenTelemetry configuration.
 * Tracing is auto-configured via micrometer-tracing-bridge-otel and
 * the OTEL exporter via spring-boot actuator + application.yml settings.
 * This class provides additional beans for custom instrumentation.
 *
 * <p>Spring Boot 3.x auto-configures {@code io.micrometer.tracing.Tracer} (Micrometer facade)
 * but does NOT expose the raw {@code io.opentelemetry.api.trace.Tracer} as a bean.
 * Services that use the OpenTelemetry API directly (e.g. SemanticMemoryService) must
 * obtain the Tracer from the auto-configured {@link OpenTelemetry} SDK instance.</p>
 */
@Configuration
public class OpenTelemetryConfig {

    /**
     * Custom span name prefix for CRM operations.
     * Used by services to generate consistent span names.
     */
    public static final String SPAN_PREFIX = "crm.";

    /**
     * Exposes the raw OpenTelemetry {@link io.opentelemetry.api.trace.Tracer} as a Spring bean.
     *
     * <p>Spring Boot auto-configures the {@link OpenTelemetry} SDK via
     * {@code micrometer-tracing-bridge-otel}. We obtain the Tracer from that
     * instance so it participates in the same pipeline (OTLP exporter, sampling, etc.).</p>
     *
     * @param openTelemetry the auto-configured OpenTelemetry SDK (injected by Spring Boot)
     * @return an instrumentation-scoped Tracer for crm-backend
     */
    @Bean
    public io.opentelemetry.api.trace.Tracer otelTracer(OpenTelemetry openTelemetry) {
        return openTelemetry.getTracer("crm-backend", "0.1.0");
    }
}
