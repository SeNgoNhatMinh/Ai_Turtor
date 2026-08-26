package com.ragapi.service;

import com.ragapi.util.StudentFacingMessages;
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
import java.util.Map;

@Slf4j
@Service
public class OpenRouterChatService {

    private final PrivacySanitizer privacySanitizer;
    private final LlmProviderAdminService providerAdminService;

    public OpenRouterChatService(PrivacySanitizer privacySanitizer, LlmProviderAdminService providerAdminService) {
        this.privacySanitizer = privacySanitizer;
        this.providerAdminService = providerAdminService;
    }

    @Value("${llm.cooldown-seconds:60}")
    private int providerCooldownSeconds;

    @Value("${llm.quota-cooldown-seconds:900}")
    private int quotaCooldownSeconds;

    @Value("${llm.quota-soft-cooldown-seconds:120}")
    private int quotaSoftCooldownSeconds;

    @Value("${llm.daily-quota-cooldown-seconds:86400}")
    private int dailyQuotaCooldownSeconds;

    @Value("${llm.provider-reorder-on-quota:true}")
    private boolean providerReorderOnQuota;

    @Value("${llm.skip-diacritics-for-english-questions:true}")
    private boolean skipDiacriticsForEnglishQuestions;

    @Value("${llm.diacritics-correction-enabled:true}")
    private boolean diacriticsCorrectionEnabled;

    @Value("${llm.skip-diacritics-for-ollama:true}")
    private boolean skipDiacriticsForOllama;

    @Value("${llm.cloud-failover-timeout-seconds:20}")
    private int cloudFailoverTimeoutSeconds;

    @Value("${ollama.chat.temperature:0.2}")
    private double ollamaTemperature;

    @Value("${ollama.chat.top-k:40}")
    private int ollamaTopK;

    @Value("${ollama.chat.num-predict:512}")
    private int ollamaNumPredict;

    @Value("${ollama.chat.num-ctx:4096}")
    private int ollamaNumCtx;

    @Value("${ollama.chat.max-retries:0}")
    private int ollamaMaxRetries;

    private volatile LlmProviderChain providerChain;
    private volatile boolean ollamaOnlyActive;
    private volatile boolean ollamaActive;
    private volatile String resolvedOllamaBaseUrl;

    @PostConstruct
    void init() {
        reloadProviderChain(true);
    }

    public synchronized void reloadProviderChain() {
        reloadProviderChain(false);
    }

    private synchronized void reloadProviderChain(boolean failIfEmpty) {
        List<LlmRuntimeSlot> slots = providerAdminService.activeRuntimeSlots();
        ollamaActive = slots.stream().anyMatch(slot -> slot.kind() == LlmRuntimeSlot.LlmRuntimeSlotKind.OLLAMA);
        ollamaOnlyActive = ollamaActive && slots.stream()
                .allMatch(slot -> slot.kind() == LlmRuntimeSlot.LlmRuntimeSlotKind.OLLAMA);
        List<LlmProviderChain.Provider> providers = buildProviders(slots);
        if (providers.isEmpty()) {
            if (failIfEmpty) {
                throw new IllegalStateException("No LLM provider is configured. Set at least one provider API key or enable Ollama chat");
            }
            providerChain = null;
            log.warn("LLM provider chain reloaded with zero active providers");
            return;
        }
        providerChain = new LlmProviderChain(providers,
                Duration.ofSeconds(Math.max(0, providerCooldownSeconds)),
                Duration.ofSeconds(Math.max(0, quotaSoftCooldownSeconds)),
                Duration.ofSeconds(Math.max(0, quotaCooldownSeconds)),
                Duration.ofSeconds(Math.max(0, dailyQuotaCooldownSeconds)),
                providerReorderOnQuota,
                java.time.Clock.systemUTC());
        log.info("LLM provider chain reloaded: ollamaOnly={}, providers={}",
                ollamaOnlyActive,
                providers.stream().map(provider -> provider.name() + "/" + provider.model()).toList());
    }

    public boolean isOllamaOnlyActive() {
        return ollamaOnlyActive;
    }

    public boolean isOllamaActive() {
        return ollamaActive;
    }

    public String resolvedOllamaBaseUrl() {
        return resolvedOllamaBaseUrl;
    }

    public String generate(String prompt) {
        return generate(prompt, null);
    }

    public String generate(String prompt, String studentQuestion) {
        String wrapped = VietnameseOutputEnforcer.wrapPrompt(prompt);
        try {
            LlmProviderChain.Result result = generateInternalResult(wrapped);
            String answer = TextSanitizer.cleanForStudentAnswer(result.text());
            answer = enforceVietnameseDiacritics(answer, studentQuestion, result.provider());
            if (StudentFacingMessages.isUnavailableMessage(answer)) {
                return answer;
            }
            return answer == null || answer.isBlank()
                    ? StudentFacingMessages.GENERATION_UNAVAILABLE
                    : answer;
        } catch (Exception error) {
            log.error("Student-facing generation failed after provider chain: {}", summarize(error));
            return StudentFacingMessages.GENERATION_UNAVAILABLE;
        }
    }

    /**
     * Executes internal utility prompts (for example retrieval-query translation)
     * without forcing a Vietnamese student-facing answer format.
     */
    public String generateUtility(String prompt) {
        try {
            String answer = generateInternalResult(prompt).text();
            return answer == null ? null : answer.trim();
        } catch (Exception error) {
            log.warn("Utility generation failed: {}", summarize(error));
            return null;
        }
    }

    public List<Map<String, Object>> providerStats() {
        LlmProviderChain chain = providerChain;
        return chain == null ? List.of() : chain.snapshot();
    }

    private String enforceVietnameseDiacritics(String answer, String studentQuestion, String providerId) {
        if (!diacriticsCorrectionEnabled) {
            return answer;
        }
        if (skipDiacriticsForOllama && "ollama".equalsIgnoreCase(providerId)) {
            return answer;
        }
        if (skipDiacriticsForEnglishQuestions
                && studentQuestion != null
                && VietnameseOutputEnforcer.isEnglishPrimary(studentQuestion)) {
            return answer;
        }
        if (answer == null || answer.isBlank() || !VietnameseOutputEnforcer.needsDiacriticsCorrection(answer)) {
            return answer;
        }
        log.info("LLM answer missing Vietnamese diacritics — running correction pass");
        try {
            String correctionPrompt = VietnameseOutputEnforcer.buildCorrectionPrompt(answer);
            String corrected = TextSanitizer.cleanForStudentAnswer(generateInternalResult(correctionPrompt).text());
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

    private LlmProviderChain.Result generateInternalResult(String prompt) throws Exception {
        String safePrompt = privacySanitizer.sanitize(prompt);
        LlmProviderChain chain = providerChain;
        if (chain == null) {
            throw new IllegalStateException("LLM provider chain is not initialized");
        }
        try {
            LlmProviderChain.Result result = chain.generate(safePrompt);
            log.info("LLM generation succeeded: provider={}, model={}", result.provider(), result.model());
            return result;
        } catch (Exception error) {
            log.error("All eligible LLM providers failed: {}", summarize(error));
            throw error;
        }
    }

    private List<LlmProviderChain.Provider> buildProviders(List<LlmRuntimeSlot> slots) {
        List<LlmProviderChain.Provider> providers = new ArrayList<>();
        boolean hasOllama = slots.stream().anyMatch(slot -> slot.kind() == LlmRuntimeSlot.LlmRuntimeSlotKind.OLLAMA);
        for (LlmRuntimeSlot slot : slots) {
            if (slot.kind() == LlmRuntimeSlot.LlmRuntimeSlotKind.OLLAMA) {
                String baseUrl = OllamaEndpointResolver.resolve(slot.baseUrl());
                resolvedOllamaBaseUrl = baseUrl;
                OllamaChatModel ollama = OllamaChatModel.builder()
                        .baseUrl(baseUrl)
                        .modelName(slot.model())
                        .timeout(Duration.ofSeconds(Math.max(15, slot.timeoutSeconds())))
                        .temperature(ollamaTemperature)
                        .topK(Math.max(1, ollamaTopK))
                        .numPredict(Math.max(64, ollamaNumPredict))
                        .numCtx(Math.max(1024, ollamaNumCtx))
                        .maxRetries(Math.max(0, ollamaMaxRetries))
                        .build();
                providers.add(new LlmProviderChain.Provider(slot.providerId(), slot.model(), ollama::generate));
                log.info("Ollama chat client ready: model={}, baseUrl={}, timeout={}s, numPredict={}, numCtx={}",
                        slot.model(), baseUrl, slot.timeoutSeconds(), ollamaNumPredict, ollamaNumCtx);
                continue;
            }
            int timeoutSeconds = slot.timeoutSeconds();
            if (hasOllama && cloudFailoverTimeoutSeconds > 0) {
                timeoutSeconds = Math.min(timeoutSeconds, cloudFailoverTimeoutSeconds);
            }
            OpenAiChatModel model = OpenAiChatModel.builder()
                    .apiKey(slot.apiKey())
                    .baseUrl(slot.baseUrl())
                    .modelName(slot.model())
                    .timeout(Duration.ofSeconds(Math.max(5, timeoutSeconds)))
                    .maxRetries(slot.maxRetries())
                    .build();
            providers.add(new LlmProviderChain.Provider(slot.providerId(), slot.model(), model::generate));
        }
        return providers;
    }

    private String summarize(Exception error) {
        return error == null ? "unknown" : LlmProviderChain.summarize(error);
    }
}
