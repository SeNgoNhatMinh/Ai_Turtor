package com.ragapi.util;

import lombok.extern.slf4j.Slf4j;
import org.slf4j.MDC;

import java.time.Duration;

/** Emits one stable log shape for end-to-end RAG latency profiling. */
@Slf4j
public final class RagStageTimer {

    private RagStageTimer() {
    }

    public static long start() {
        return System.nanoTime();
    }

    public static void record(String stage, long startedNanos) {
        long elapsedMs = Duration.ofNanos(System.nanoTime() - startedNanos).toMillis();
        String traceId = MDC.get("traceId");
        log.info("rag_latency traceId={} stage={} elapsedMs={}",
                traceId == null || traceId.isBlank() ? "untracked" : traceId,
                stage,
                elapsedMs);
    }
}
