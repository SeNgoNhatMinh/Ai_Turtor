package com.ragapi.service.aiworker;

import org.junit.jupiter.api.Test;

import java.time.Duration;
import java.util.LinkedHashMap;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.mockito.Mockito.mock;

class AiWorkerOrchestratorTest {

    private final AiWorkerOrchestrator orchestrator = new AiWorkerOrchestrator(Runnable::run, mock(AiWorkerTraceService.class));

    @Test
    void preservesSuccessfulWorkerWhenSiblingFails() {
        Map<String, java.util.function.Supplier<String>> workers = new LinkedHashMap<>();
        workers.put("theory", () -> "grounded explanation");
        workers.put("example", () -> {
            throw new IllegalStateException("provider unavailable");
        });

        Map<String, AiWorkerResult<String>> results =
                orchestrator.executeParallel(workers, Duration.ofSeconds(1));

        assertEquals(AiWorkerResult.Status.SUCCESS, results.get("theory").status());
        assertEquals("grounded explanation", results.get("theory").value());
        assertEquals(AiWorkerResult.Status.FAILED, results.get("example").status());
        assertNull(results.get("example").value());
    }

    @Test
    void rejectsNonPositiveTimeout() {
        org.junit.jupiter.api.Assertions.assertThrows(
                IllegalArgumentException.class,
                () -> orchestrator.executeParallel(Map.of("theory", () -> "answer"), Duration.ZERO)
        );
    }
}
