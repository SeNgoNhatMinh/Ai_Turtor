package com.ragapi.service.aiworker;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Objects;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CompletionException;
import java.util.concurrent.Executor;
import java.util.concurrent.RejectedExecutionException;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;
import java.util.function.Supplier;

/**
 * Runs independent in-process AI tasks concurrently with bounded capacity,
 * per-task timeout, and partial-success semantics. This component deliberately
 * does not perform RAG retrieval or alter existing answer-generation behavior.
 */
@Slf4j
@Service
public class AiWorkerOrchestrator {

    private final Executor executor;
    private final AiWorkerTraceService traceService;

    public AiWorkerOrchestrator(@Qualifier("aiWorkerExecutor") Executor executor, AiWorkerTraceService traceService) {
        this.executor = executor;
        this.traceService = traceService;
    }

    public <T> Map<String, AiWorkerResult<T>> executeParallel(
            Map<String, ? extends Supplier<T>> workers,
            Duration timeout
    ) {
        Objects.requireNonNull(workers, "workers must not be null");
        Objects.requireNonNull(timeout, "timeout must not be null");
        if (timeout.isZero() || timeout.isNegative()) {
            throw new IllegalArgumentException("Worker timeout must be positive");
        }

        Map<String, CompletableFuture<AiWorkerResult<T>>> futures = new LinkedHashMap<>();
        for (Map.Entry<String, ? extends Supplier<T>> entry : workers.entrySet()) {
            String workerName = entry.getKey();
            Supplier<T> task = entry.getValue();
            long started = System.nanoTime();
            String traceId = traceService.currentTraceId();
            traceService.record(traceId, workerName, workerName, "STARTED", "RUNNING", null, 0L, "Worker started");

            try {
                CompletableFuture<AiWorkerResult<T>> future = CompletableFuture
                        .supplyAsync(() -> task.get(), executor)
                        .orTimeout(timeout.toMillis(), TimeUnit.MILLISECONDS)
                        .handle((value, failure) -> {
                            long elapsedMs = elapsedMs(started);
                            if (failure == null) {
                                traceService.record(traceId, workerName, workerName, "FINISHED", "SUCCESS", null, elapsedMs, "Worker completed");
                                return AiWorkerResult.success(value, elapsedMs);
                            }
                            Throwable cause = unwrap(failure);
                            if (cause instanceof TimeoutException) {
                                log.warn("AI worker {} timed out after {} ms", workerName, elapsedMs);
                                traceService.record(traceId, workerName, workerName, "FINISHED", "TIMED_OUT", null, elapsedMs, "Worker timed out");
                                return AiWorkerResult.timedOut(elapsedMs);
                            }
                            log.warn("AI worker {} failed: {}", workerName, cause.getClass().getSimpleName());
                            traceService.record(traceId, workerName, workerName, "FINISHED", "FAILED", null, elapsedMs, cause.getClass().getSimpleName());
                            return AiWorkerResult.failed(cause.getClass().getSimpleName(), elapsedMs);
                        });
                futures.put(workerName, future);
            } catch (RejectedExecutionException rejected) {
                log.warn("AI worker {} rejected because the bounded pool is saturated", workerName);
                traceService.record(traceId, workerName, workerName, "FINISHED", "REJECTED", null, elapsedMs(started), "Worker pool is saturated");
                futures.put(workerName, CompletableFuture.completedFuture(
                        AiWorkerResult.rejected("AI worker pool is saturated")));
            }
        }

        Map<String, AiWorkerResult<T>> results = new LinkedHashMap<>();
        futures.forEach((name, future) -> results.put(name, future.join()));
        return results;
    }

    private static long elapsedMs(long startedNanos) {
        return TimeUnit.NANOSECONDS.toMillis(System.nanoTime() - startedNanos);
    }

    private static Throwable unwrap(Throwable failure) {
        Throwable current = failure;
        while ((current instanceof CompletionException || current instanceof java.util.concurrent.ExecutionException)
                && current.getCause() != null) {
            current = current.getCause();
        }
        return current;
    }
}
