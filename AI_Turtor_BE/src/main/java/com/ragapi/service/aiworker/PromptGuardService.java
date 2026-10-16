package com.ragapi.service.aiworker;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.function.Supplier;

/**
 * Prompt-injection screening using Groq-hosted Llama Prompt Guard 2 models.
 * The service is opt-in and never logs the user's prompt or API key.
 */
@Slf4j
@Service
public class PromptGuardService {

    private enum Verdict { SAFE, ATTACK, UNKNOWN }

    private final AiWorkerOrchestrator orchestrator;
    private final ObjectMapper objectMapper;
    private final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(3))
            .build();

    @Value("${AI_WORKER_PROMPT_GUARD_ENABLED:false}")
    private boolean enabled;

    @Value("${GROQ_API_KEY:}")
    private String apiKey;

    @Value("${AI_WORKER_PROMPT_GUARD_BASE_URL:https://api.groq.com/openai/v1}")
    private String baseUrl;

    @Value("${AI_WORKER_PROMPT_GUARD_WORKER_2_MODEL:meta-llama/llama-prompt-guard-2-22m}")
    private String worker2Model;

    @Value("${AI_WORKER_PROMPT_GUARD_WORKER_3_MODEL:meta-llama/llama-prompt-guard-2-86m}")
    private String worker3Model;

    @Value("${AI_WORKER_PROMPT_GUARD_TIMEOUT_SECONDS:8}")
    private long timeoutSeconds;

    public PromptGuardService(AiWorkerOrchestrator orchestrator, ObjectMapper objectMapper) {
        this.orchestrator = orchestrator;
        this.objectMapper = objectMapper;
    }

    /**
     * Returns true only when a configured classifier explicitly identifies an attack.
     * Provider failures are logged and fail open to preserve tutor availability.
     */
    public boolean isPromptAttack(String text) {
        if (!enabled || text == null || text.isBlank()) {
            return false;
        }
        if (apiKey == null || apiKey.isBlank()) {
            log.warn("Prompt Guard is enabled but GROQ_API_KEY is missing; screening skipped");
            return false;
        }

        Map<String, Supplier<Verdict>> workers = new LinkedHashMap<>();
        workers.put("prompt-guard-worker-2", () -> classifySegments(text, worker2Model, "worker-2"));
        workers.put("prompt-guard-worker-3", () -> classifySegments(text, worker3Model, "worker-3"));

        Map<String, AiWorkerResult<Verdict>> results =
                orchestrator.executeParallel(workers, Duration.ofSeconds(Math.max(1, timeoutSeconds)));

        for (Map.Entry<String, AiWorkerResult<Verdict>> entry : results.entrySet()) {
            AiWorkerResult<Verdict> result = entry.getValue();
            if (result.status() == AiWorkerResult.Status.SUCCESS && result.value() == Verdict.ATTACK) {
                log.warn("{} detected a likely prompt injection (durationMs={})",
                        entry.getKey(), result.durationMs());
                return true;
            }
            if (result.status() != AiWorkerResult.Status.SUCCESS || result.value() == Verdict.UNKNOWN) {
                log.warn("{} could not produce a confident classification (status={}, durationMs={})",
                        entry.getKey(), result.status(), result.durationMs());
            } else {
                log.debug("{} classified input as safe (durationMs={})",
                        entry.getKey(), result.durationMs());
            }
        }
        return false;
    }

    private Verdict classifySegments(String text, String model, String workerName) {
        if (model == null || model.isBlank()) {
            log.warn("{} has no configured model", workerName);
            return Verdict.UNKNOWN;
        }
        List<String> segments = splitIntoSegments(text, 1_200);
        boolean unknown = false;
        for (String segment : segments) {
            Verdict verdict = classify(segment, model, workerName);
            if (verdict == Verdict.ATTACK) {
                return Verdict.ATTACK;
            }
            if (verdict == Verdict.UNKNOWN) {
                unknown = true;
            }
        }
        return unknown ? Verdict.UNKNOWN : Verdict.SAFE;
    }

    private Verdict classify(String text, String model, String workerName) {
        try {
            Map<String, Object> body = Map.of(
                    "model", model,
                    "messages", List.of(Map.of("role", "user", "content", text)),
                    "temperature", 0,
                    "max_tokens", 16
            );
            String json = objectMapper.writeValueAsString(body);
            String endpoint = baseUrl.replaceAll("/+$", "") + "/chat/completions";
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(endpoint))
                    .timeout(Duration.ofSeconds(4))
                    .header("Authorization", "Bearer " + apiKey)
                    .header("Content-Type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(json))
                    .build();

            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() < 200 || response.statusCode() >= 300) {
                log.warn("{} API returned HTTP {}", workerName, response.statusCode());
                return Verdict.UNKNOWN;
            }
            JsonNode root = objectMapper.readTree(response.body());
            JsonNode content = root.path("choices").path(0).path("message").path("content");
            if (!content.isTextual()) {
                log.warn("{} API response did not contain classification text", workerName);
                return Verdict.UNKNOWN;
            }
            String label = content.asText().trim().toLowerCase(java.util.Locale.ROOT);
            if (label.matches("(?s)^(malicious|unsafe|attack)(\\b|\\s|[.:]).*")) {
                return Verdict.ATTACK;
            }
            if (label.matches("(?s)^(benign|safe|non[- ]malicious)(\\b|\\s|[.:]).*")) {
                return Verdict.SAFE;
            }
            log.warn("{} returned an unrecognized classification label", workerName);
            return Verdict.UNKNOWN;
        } catch (InterruptedException interrupted) {
            Thread.currentThread().interrupt();
            log.warn("{} request was interrupted", workerName);
            return Verdict.UNKNOWN;
        } catch (Exception exception) {
            log.warn("{} request failed ({})", workerName, exception.getClass().getSimpleName());
            return Verdict.UNKNOWN;
        }
    }

    private List<String> splitIntoSegments(String text, int maxChars) {
        List<String> segments = new ArrayList<>();
        String remaining = text == null ? "" : text.trim();
        while (!remaining.isEmpty()) {
            if (remaining.length() <= maxChars) {
                segments.add(remaining);
                break;
            }
            int boundary = remaining.lastIndexOf(' ', maxChars);
            if (boundary < maxChars / 2) {
                boundary = maxChars;
            }
            segments.add(remaining.substring(0, boundary).trim());
            remaining = remaining.substring(boundary).trim();
        }
        return segments;
    }
}
