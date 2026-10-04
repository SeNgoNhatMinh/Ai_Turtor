package com.ragapi.config;

import com.ragapi.service.EmbeddingService;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.MDC;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.time.Duration;
import java.time.Instant;
import java.util.UUID;

/** Correlates n8n and backend stage timings without changing API response contracts. */
@Component
public class RagTraceFilter extends OncePerRequestFilter {

    public static final String TRACE_HEADER = "X-Trace-Id";
    private final EmbeddingService embeddingService;

    public RagTraceFilter(EmbeddingService embeddingService) {
        this.embeddingService = embeddingService;
    }

    @Override
    protected void doFilterInternal(
            HttpServletRequest request,
            HttpServletResponse response,
            FilterChain filterChain
    ) throws ServletException, IOException {
        String traceId = sanitize(request.getHeader(TRACE_HEADER));
        if (traceId == null) {
            traceId = UUID.randomUUID().toString();
        }
        MDC.put("traceId", traceId);
        response.setHeader(TRACE_HEADER, traceId);
        try {
            recordHarnessTransit(request.getHeader("X-Trace-Started-At"), traceId);
            filterChain.doFilter(request, response);
        } finally {
            embeddingService.clearRequestMemo();
            MDC.remove("traceId");
        }
    }

    private void recordHarnessTransit(String startedAt, String traceId) {
        if (startedAt == null || startedAt.isBlank()) return;
        try {
            long elapsedMs = Math.max(0, Duration.between(Instant.parse(startedAt.trim()), Instant.now()).toMillis());
            org.slf4j.LoggerFactory.getLogger(RagTraceFilter.class).info(
                    "rag_latency traceId={} stage=T1_N8N_TO_BE elapsedMs={}", traceId, elapsedMs);
        } catch (RuntimeException ignored) {
            // Invalid optional timing metadata must never reject a student request.
        }
    }

    private String sanitize(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.length() <= 128 && trimmed.matches("[A-Za-z0-9._:-]+") ? trimmed : null;
    }
}
