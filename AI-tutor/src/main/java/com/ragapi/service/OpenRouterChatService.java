package com.ragapi.service;

import com.ragapi.util.TextSanitizer;
import com.ragapi.util.VietnameseOutputEnforcer;
import dev.langchain4j.model.openai.OpenAiChatModel;
import dev.langchain4j.model.ollama.OllamaChatModel;
import jakarta.annotation.PostConstruct;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;

@Slf4j
@Service
public class OpenRouterChatService {

    private final PrivacySanitizer privacySanitizer;

    public OpenRouterChatService(PrivacySanitizer privacySanitizer) {
        this.privacySanitizer = privacySanitizer;
    }

    @Value("${openrouter.api-key}")
    private String primaryApiKey;

    @Value("${openrouter.enabled:true}")
    private boolean primaryEnabled;

    @Value("${openrouter.base-url}")
    private String primaryBaseUrl;

    @Value("${openrouter.model}")
    private String primaryModelName;

    @Value("${openrouter.timeout-seconds:60}")
    private int primaryTimeoutSeconds;

    @Value("${openrouter.max-retries:0}")
    private int primaryMaxRetries;

    @Value("${llm.groq.enabled:true}")
    private boolean groqEnabled;

    @Value("${llm.groq.api-key:}")
    private String groqApiKey;

    @Value("${llm.groq.base-url:https://api.groq.com/openai/v1}")
    private String groqBaseUrl;

    @Value("${llm.groq.model:openai/gpt-oss-120b}")
    private String groqModelName;

    @Value("${llm.groq.models:}")
    private String groqModelNames;

    @Value("${llm.groq.timeout-seconds:60}")
    private int groqTimeoutSeconds;

    @Value("${llm.nvidia.enabled:true}")
    private boolean nvidiaEnabled;

    @Value("${llm.nvidia.api-key:}")
    private String nvidiaApiKey;

    @Value("${llm.nvidia.base-url:https://integrate.api.nvidia.com/v1}")
    private String nvidiaBaseUrl;

    @Value("${llm.nvidia.models:nvidia/nemotron-3-super-120b-a12b}")
    private String nvidiaModelNames;

    @Value("${llm.nvidia.timeout-seconds:90}")
    private int nvidiaTimeoutSeconds;

    @Value("${llm.cooldown-seconds:60}")
    private int providerCooldownSeconds;

    @Value("${llm.quota-cooldown-seconds:900}")
    private int quotaCooldownSeconds;

    @Value("${llm.daily-quota-cooldown-seconds:86400}")
    private int dailyQuotaCooldownSeconds;

    @Value("${openrouter.fallback.enabled:true}")
    private boolean fallbackEnabled;

    @Value("${openrouter.fallback.api-key:}")
    private String fallbackApiKey;

    @Value("${openrouter.fallback.base-url:https://openrouter.ai/api/v1}")
    private String fallbackBaseUrl;

    @Value("${openrouter.fallback.model:}")
    private String fallbackModelName;

    @Value("${openrouter.fallback.timeout-seconds:60}")
    private int fallbackTimeoutSeconds;

    @Value("${openrouter.fallback.max-retries:0}")
    private int fallbackMaxRetries;

    @Value("${openrouter.free-router.enabled:true}")
    private boolean freeRouterEnabled;

    @Value("${openrouter.free-router.model:openrouter/free}")
    private String freeRouterModelName;

    @Value("${ollama.chat.enabled:false}")
    private boolean ollamaChatEnabled;

    @Value("${ollama.base-url:http://localhost:11434}")
    private String ollamaBaseUrl;

    @Value("${ollama.chat.model:}")
    private String ollamaChatModelName;

    @Value("${ollama.chat.timeout-seconds:120}")
    private int ollamaChatTimeoutSeconds;

    private LlmProviderChain providerChain;

    @PostConstruct
    void init() {
        List<LlmProviderChain.Provider> providers = new ArrayList<>();
        List<String> configuredGroqModels = parseModels(groqModelNames);
        if (configuredGroqModels.isEmpty() && hasText(groqModelName)) {
            configuredGroqModels = List.of(groqModelName.trim());
        }
        for (int index = 0; index < configuredGroqModels.size(); index++) {
            String modelName = configuredGroqModels.get(index);
            addOpenAiProvider(providers, "groq-" + (index + 1), groqEnabled, groqApiKey, groqBaseUrl,
                    modelName, groqTimeoutSeconds, 0);
        }
        List<String> configuredNvidiaModels = parseModels(nvidiaModelNames);
        for (int index = 0; index < configuredNvidiaModels.size(); index++) {
            String modelName = configuredNvidiaModels.get(index);
            addOpenAiProvider(providers, "nvidia-" + (index + 1), nvidiaEnabled, nvidiaApiKey, nvidiaBaseUrl,
                    modelName, nvidiaTimeoutSeconds, 0);
        }
        addOpenAiProvider(providers, "openrouter-primary", primaryEnabled, primaryApiKey, primaryBaseUrl,
                primaryModelName, primaryTimeoutSeconds, primaryMaxRetries);
        String fallbackKey = hasUsableApiKey(fallbackApiKey) ? fallbackApiKey : primaryApiKey;
        addOpenAiProvider(providers, "openrouter-fallback", fallbackEnabled, fallbackKey, fallbackBaseUrl,
                fallbackModelName, fallbackTimeoutSeconds, fallbackMaxRetries);
        addOpenAiProvider(providers, "openrouter-free-router", freeRouterEnabled, primaryApiKey, primaryBaseUrl,
                freeRouterModelName, primaryTimeoutSeconds, primaryMaxRetries);

        if (ollamaChatEnabled && hasText(ollamaChatModelName)) {
            OllamaChatModel ollama = OllamaChatModel.builder()
                    .baseUrl(ollamaBaseUrl)
                    .modelName(ollamaChatModelName)
                    .timeout(Duration.ofSeconds(ollamaChatTimeoutSeconds))
                    .build();
            providers.add(new LlmProviderChain.Provider("ollama", ollamaChatModelName, ollama::generate));
        }
        if (providers.isEmpty()) {
            throw new IllegalStateException("No LLM provider is configured. Set at least one provider API key or enable Ollama chat");
        }
        providerChain = new LlmProviderChain(providers,
                Duration.ofSeconds(Math.max(0, providerCooldownSeconds)),
                Duration.ofSeconds(Math.max(0, quotaCooldownSeconds)),
                Duration.ofSeconds(Math.max(0, dailyQuotaCooldownSeconds)),
                java.time.Clock.systemUTC());
        log.info("LLM provider chain initialized: {}", providers.stream()
                .map(provider -> provider.name() + "/" + provider.model()).toList());
    }

    public String generate(String prompt) throws Exception {
        String wrapped = VietnameseOutputEnforcer.wrapPrompt(prompt);
        String answer = TextSanitizer.cleanForStudentAnswer(generateInternal(wrapped));
        return enforceVietnameseDiacritics(answer);
    }

    /**
     * Executes internal utility prompts (for example retrieval-query translation)
     * without forcing a Vietnamese student-facing answer format.
     */
    public String generateUtility(String prompt) throws Exception {
        String answer = generateInternal(prompt);
        return answer == null ? null : answer.trim();
    }

    public List<Map<String, Object>> providerStats() {
        return providerChain.snapshot();
    }

    private String enforceVietnameseDiacritics(String answer) throws Exception {
        if (answer == null || answer.isBlank() || !VietnameseOutputEnforcer.needsDiacriticsCorrection(answer)) {
            return answer;
        }
        log.info("LLM answer missing Vietnamese diacritics — running correction pass");
        try {
            String correctionPrompt = VietnameseOutputEnforcer.buildCorrectionPrompt(answer);
            String corrected = TextSanitizer.cleanForStudentAnswer(generateInternal(correctionPrompt));
            if (corrected == null || corrected.isBlank()) {
                return answer;
            }
            if (!VietnameseOutputEnforcer.needsDiacriticsCorrection(corrected)) {
                return corrected;
            }
            if (VietnameseOutputEnforcer.diacriticsScore(corrected) > VietnameseOutputEnforcer.diacriticsScore(answer)) {
                return corrected;
            }
        } catch (Exception correctionError) {
            log.warn("Vietnamese diacritics correction pass failed: {}", summarize(correctionError));
        }
        return answer;
    }

    private String generateInternal(String prompt) throws Exception {
        String safePrompt = privacySanitizer.sanitize(prompt);
        try {
            LlmProviderChain.Result result = providerChain.generate(safePrompt);
            log.info("LLM generation succeeded: provider={}, model={}", result.provider(), result.model());
            return result.text();
        } catch (Exception error) {
            log.error("All eligible LLM providers failed: {}", summarize(error));
            throw error;
        }
    }

    private void addOpenAiProvider(List<LlmProviderChain.Provider> providers, String name, boolean enabled,
                                   String apiKey, String baseUrl, String modelName, int timeoutSeconds, int maxRetries) {
        if (!enabled || !hasUsableApiKey(apiKey) || !hasText(baseUrl) || !hasText(modelName)) {
            return;
        }
        OpenAiChatModel model = buildModel(apiKey, baseUrl, modelName, timeoutSeconds, maxRetries);
        providers.add(new LlmProviderChain.Provider(name, modelName, model::generate));
    }

    private OpenAiChatModel buildModel(String apiKey, String baseUrl, String modelName, int timeoutSeconds, int maxRetries) {
        return OpenAiChatModel.builder()
                .apiKey(apiKey)
                .baseUrl(baseUrl)
                .modelName(modelName)
                .timeout(Duration.ofSeconds(timeoutSeconds))
                .maxRetries(maxRetries)
                .build();
    }

    private String summarize(Exception error) {
        return error == null ? "unknown" : LlmProviderChain.summarize(error);
    }

    private boolean hasText(String value) {
        return value != null && !value.isBlank();
    }

    private boolean hasUsableApiKey(String value) {
        return hasText(value) && !value.toLowerCase(Locale.ROOT).startsWith("missing-");
    }

    private List<String> parseModels(String value) {
        if (!hasText(value)) {
            return List.of();
        }
        return java.util.Arrays.stream(value.split(","))
                .map(String::trim)
                .filter(this::hasText)
                .distinct()
                .toList();
    }
}
