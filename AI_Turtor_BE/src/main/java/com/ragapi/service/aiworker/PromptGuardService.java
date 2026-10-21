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

    @Value("${AI_WORKER_PROMPT_GUARD_WORKER_2_ENABLED:false}")
    private boolean worker2Enabled;

    @Value("${AI_WORKER_PROMPT_GUARD_WORKER_3_ENABLED:false}")
    private boolean worker3Enabled;

    @Value("${GROQ_API_KEY:}")
    private String sharedApiKey;

    @Value("${AI_WORKER_PROMPT_GUARD_WORKER_2_API_KEY:}")
    private String worker2ApiKey;

    @Value("${AI_WORKER_PROMPT_GUARD_WORKER_3_API_KEY:}")
    private String worker3ApiKey;

    @Value("${AI_WORKER_PROMPT_GUARD_BASE_URL:https://api.groq.com/openai/v1}")
    private String sharedBaseUrl;

    @Value("${AI_WORKER_PROMPT_GUARD_WORKER_2_BASE_URL:}")
    private String worker2BaseUrl;

    @Value("${AI_WORKER_PROMPT_GUARD_WORKER_3_BASE_URL:}")
    private String worker3BaseUrl;

    @Value("${AI_WORKER_PROMPT_GUARD_WORKER_2_MODEL:meta-llama/llama-prompt-guard-2-22m}")
    private String worker2Model;

    @Value("${AI_WORKER_PROMPT_GUARD_WORKER_3_MODEL:meta-llama/llama-prompt-guard-2-86m}")
    private String worker3Model;

    @Value("${AI_WORKER_PROMPT_GUARD_TIMEOUT_SECONDS:5}")
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

        Map<String, Supplier<Verdict>> workers = new LinkedHashMap<>();
        if (worker2Enabled) {
            workers.put("prompt-guard-worker-2", () -> classifySegments(
                    text,
                    worker2Model,
                    resolveKey(worker2ApiKey),
                    resolveBaseUrl(worker2BaseUrl),
                    "worker-2"));
        }
        if (worker3Enabled) {
            workers.put("prompt-guard-worker-3", () -> classifySegments(
                    text,
                    worker3Model,
                    resolveKey(worker3ApiKey),
                    resolveBaseUrl(worker3BaseUrl),
                    "worker-3"));
        }
        if (workers.isEmpty()) {
            log.warn("Prompt Guard master switch is on but worker-2 and worker-3 are disabled; screening skipped");
            return false;
        }

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

    private String resolveKey(String workerKey) {
        if (workerKey != null && !workerKey.isBlank()) {
            return workerKey.trim();
        }
        return sharedApiKey == null ? "" : sharedApiKey.trim();
    }

    private String resolveBaseUrl(String workerBaseUrl) {
        if (workerBaseUrl != null && !workerBaseUrl.isBlank()) {
            return workerBaseUrl.trim();
        }
        return sharedBaseUrl == null || sharedBaseUrl.isBlank()
                ? "https://api.groq.com/openai/v1"
                : sharedBaseUrl.trim();
    }

    private Verdict classifySegments(String text, String model, String apiKey, String baseUrl, String workerName) {
        if (model == null || model.isBlank()) {
            log.warn("{} has no configured model", workerName);
            return Verdict.UNKNOWN;
        }
        if (apiKey == null || apiKey.isBlank()) {
            log.warn("{} is enabled but its API key is missing; screening skipped for this worker", workerName);
            return Verdict.UNKNOWN;
        }
        List<String> segments = splitIntoSegments(text, 600);
        boolean unknown = false;
        for (String segment : segments) {
            Verdict verdict = classify(segment, model, apiKey, baseUrl, workerName);
            if (verdict == Verdict.ATTACK) {
                return Verdict.ATTACK;
            }
            if (verdict == Verdict.UNKNOWN) {
                unknown = true;
            }
        }
        return unknown ? Verdict.UNKNOWN : Verdict.SAFE;
    }

    private Verdict classify(String text, String model, String apiKey, String baseUrl, String workerName) {
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
            // Groq-hosted Prompt Guard 2 returns a malicious-probability score
            // (benign ~0.0, jailbreak ~1.0) instead of a text label.
            try {
                double maliciousScore = Double.parseDouble(label);
                if (maliciousScore >= 0.0 && maliciousScore <= 1.0) {
                    return maliciousScore >= 0.5 ? Verdict.ATTACK : Verdict.SAFE;
                }
            } catch (NumberFormatException ignored) {
                // Fall through to text-label parsing.
            }
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
