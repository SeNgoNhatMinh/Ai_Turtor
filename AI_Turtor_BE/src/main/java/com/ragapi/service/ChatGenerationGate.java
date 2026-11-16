package com.ragapi.service;

import org.slf4j.MDC;
import org.springframework.stereotype.Service;

import java.util.Set;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.Future;

/**
 * Stops an in-flight student chat generation: the stop button marks the
 * harness trace, running workers are cancelled, and the request must not
 * save an answer afterwards.
 */
@Service
public class ChatGenerationGate {
    private static final String TRACE_MDC = "aiTraceId";

    private final ConcurrentHashMap<String, Run> runs = new ConcurrentHashMap<>();
    private final ConcurrentHashMap<String, String> pendingCancels = new ConcurrentHashMap<>();

    public void bind(String traceId, String studentId) {
        if (traceId == null || traceId.isBlank() || studentId == null || studentId.isBlank()) return;
        String safeTrace = traceId.trim();
        String safeStudent = studentId.trim();
        String pendingOwner = pendingCancels.remove(safeTrace);
        if (safeStudent.equals(pendingOwner)) {
            throw new GenerationCancelledException(safeTrace);
        }
        MDC.put(TRACE_MDC, safeTrace);
        runs.put(safeTrace, new Run(safeTrace, safeStudent, Thread.currentThread()));
    }

    public void release(String traceId) {
        if (traceId == null || traceId.isBlank()) return;
        runs.remove(traceId.trim());
        String current = MDC.get(TRACE_MDC);
        if (traceId.trim().equals(current)) {
            MDC.remove(TRACE_MDC);
        }
        Thread.interrupted();
    }

    /** @return true when this student owned the trace (or pre-cancelled it). */
    public boolean cancel(String traceId, String studentId) {
        if (traceId == null || traceId.isBlank() || studentId == null || studentId.isBlank()) return false;
        String safeTrace = traceId.trim();
        String safeStudent = studentId.trim();
        Run run = runs.get(safeTrace);
        if (run == null) {
            pendingCancels.put(safeTrace, safeStudent);
            return true;
        }
        if (!safeStudent.equals(run.studentId)) return false;
        run.cancelled = true;
        for (Future<?> future : run.futures) {
            future.cancel(true);
        }
        if (run.worker != null) {
            run.worker.interrupt();
        }
        return true;
    }

    public void track(CompletableFuture<?> future) {
        Run run = currentRun();
        if (run != null && future != null) {
            run.futures.add(future);
            if (run.cancelled) future.cancel(true);
        }
    }

    public void checkpoint() {
        Run run = currentRun();
        if (run != null && run.cancelled) {
            throw new GenerationCancelledException(run.traceId);
        }
        if (Thread.currentThread().isInterrupted()) {
            String traceId = run == null ? MDC.get(TRACE_MDC) : run.traceId;
            if (traceId != null) throw new GenerationCancelledException(traceId);
        }
    }

    private Run currentRun() {
        String traceId = MDC.get(TRACE_MDC);
        if (traceId == null || traceId.isBlank()) return null;
        return runs.get(traceId);
    }

    private static final class Run {
        private final String traceId;
        private final String studentId;
        private final Thread worker;
        private final Set<Future<?>> futures = ConcurrentHashMap.newKeySet();
        private volatile boolean cancelled;

        private Run(String traceId, String studentId, Thread worker) {
            this.traceId = traceId;
            this.studentId = studentId;
            this.worker = worker;
        }
    }

    public static class GenerationCancelledException extends RuntimeException {
        public GenerationCancelledException(String traceId) {
            super("Generation cancelled: " + traceId);
        }
    }
}
