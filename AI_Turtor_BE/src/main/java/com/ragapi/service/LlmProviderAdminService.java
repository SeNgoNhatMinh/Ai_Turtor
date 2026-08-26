package com.ragapi.service;

import com.ragapi.dto.LlmProviderConfigView;
import com.ragapi.dto.UpdateLlmProviderRequest;
import com.ragapi.entity.LlmProviderOverride;
import com.ragapi.repository.LlmProviderOverrideRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Lazy;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

@Slf4j
@Service
public class LlmProviderAdminService {

    private record EnvSlot(
            String providerId,
            String family,
            String label,
            boolean envEnabled,
            String envModel,
            String baseUrl,
            String apiKey,
            int timeoutSeconds,
            int maxRetries,
            LlmRuntimeSlot.LlmRuntimeSlotKind kind
    ) {}

    private final LlmProviderOverrideRepository overrideRepository;
    private final OpenRouterChatService chatService;

    public LlmProviderAdminService(LlmProviderOverrideRepository overrideRepository,
                                   @Lazy OpenRouterChatService chatService) {
        this.overrideRepository = overrideRepository;
        this.chatService = chatService;
    }

    @Value("${openrouter.enabled:true}")
    private boolean primaryEnabled;
    @Value("${openrouter.api-key:}")
    private String primaryApiKey;
    @Value("${openrouter.base-url:}")
    private String primaryBaseUrl;
    @Value("${openrouter.model:}")
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
    @Value("${llm.groq.model:}")
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
    @Value("${llm.nvidia.models:}")
    private String nvidiaModelNames;
    @Value("${llm.nvidia.timeout-seconds:90}")
    private int nvidiaTimeoutSeconds;

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

    public List<LlmProviderConfigView> listProviderConfigs() {
        Map<String, LlmProviderOverride> overrides = overrideRepository.findAll().stream()
                .collect(Collectors.toMap(LlmProviderOverride::getProviderId, Function.identity(), (a, b) -> b, LinkedHashMap::new));
        List<LlmProviderConfigView> views = new ArrayList<>();
        for (EnvSlot slot : discoverSlots()) {
            views.add(toView(slot, overrides.get(slot.providerId())));
        }
        return views;
    }

    public List<LlmRuntimeSlot> activeRuntimeSlots() {
        Map<String, LlmProviderOverride> overrides = overrideRepository.findAll().stream()
                .collect(Collectors.toMap(LlmProviderOverride::getProviderId, Function.identity()));
        List<LlmRuntimeSlot> active = new ArrayList<>();
        for (EnvSlot slot : discoverSlots()) {
            LlmProviderOverride override = overrides.get(slot.providerId());
            if (isEffectiveEnabled(slot, override)) {
                active.add(toRuntimeSlot(slot, override));
            }
        }
        return active;
    }

    public LlmProviderConfigView updateProvider(String providerId, UpdateLlmProviderRequest request, String adminUserId) {
        EnvSlot slot = requireSlot(providerId);
        LlmProviderOverride override = overrideRepository.findById(providerId).orElseGet(() -> LlmProviderOverride.builder()
                .providerId(providerId)
                .build());
        if (request.getEnabled() != null) {
            override.setEnabled(request.getEnabled());
        }
        if (request.getModel() != null) {
            String model = request.getModel().trim();
            if (model.isEmpty()) {
                override.setModel(null);
            } else {
                if (slot.kind() == LlmRuntimeSlot.LlmRuntimeSlotKind.OLLAMA
                        && !OllamaEndpointResolver.isModelInstalled(slot.baseUrl(), model)) {
                    throw new IllegalArgumentException(
                            "Ollama model '" + model + "' is not installed. Run: ollama pull " + model);
                }
                override.setModel(model);
            }
        }
        override.setDeleted(false);
        override.setUpdatedBy(trim(adminUserId));
        override.setUpdatedAt(LocalDateTime.now());
        overrideRepository.save(override);
        chatService.reloadProviderChain();
        return toView(slot, override);
    }

    public LlmProviderConfigView setEnabled(String providerId, boolean enabled, String adminUserId) {
        UpdateLlmProviderRequest request = new UpdateLlmProviderRequest();
        request.setEnabled(enabled);
        return updateProvider(providerId, request, adminUserId);
    }

    public LlmProviderConfigView deleteProvider(String providerId, String adminUserId) {
        EnvSlot slot = requireSlot(providerId);
        LlmProviderOverride override = overrideRepository.findById(providerId).orElseGet(() -> LlmProviderOverride.builder()
                .providerId(providerId)
                .build());
        override.setDeleted(true);
        override.setEnabled(false);
        override.setUpdatedBy(trim(adminUserId));
        override.setUpdatedAt(LocalDateTime.now());
        overrideRepository.save(override);
        chatService.reloadProviderChain();
        log.info("Admin deleted LLM provider slot {} by {}", providerId, adminUserId);
        return toView(slot, override);
    }

    public LlmProviderConfigView restoreProvider(String providerId, String adminUserId) {
        EnvSlot slot = requireSlot(providerId);
        LlmProviderOverride override = overrideRepository.findById(providerId).orElseGet(() -> LlmProviderOverride.builder()
                .providerId(providerId)
                .build());
        override.setDeleted(false);
        override.setEnabled(true);
        override.setUpdatedBy(trim(adminUserId));
        override.setUpdatedAt(LocalDateTime.now());
        overrideRepository.save(override);
        chatService.reloadProviderChain();
        return toView(slot, override);
    }

    public void reloadRuntimeChain() {
        chatService.reloadProviderChain();
    }

    private EnvSlot requireSlot(String providerId) {
        return discoverSlots().stream()
                .filter(slot -> slot.providerId().equals(providerId))
                .findFirst()
                .orElseThrow(() -> new IllegalArgumentException("Unknown providerId: " + providerId));
    }

    private List<EnvSlot> discoverSlots() {
        List<EnvSlot> slots = new ArrayList<>();
        List<String> groqModels = parseModels(groqModelNames);
        if (groqModels.isEmpty() && hasText(groqModelName)) {
            groqModels = List.of(groqModelName.trim());
        }
        for (int index = 0; index < groqModels.size(); index++) {
            slots.add(new EnvSlot(
                    "groq-" + (index + 1),
                    "groq",
                    "Groq " + (index + 1),
                    groqEnabled,
                    groqModels.get(index),
                    groqBaseUrl,
                    groqApiKey,
                    groqTimeoutSeconds,
                    0,
                    LlmRuntimeSlot.LlmRuntimeSlotKind.OPENAI_COMPAT
            ));
        }
        List<String> nvidiaModels = parseModels(nvidiaModelNames);
        for (int index = 0; index < nvidiaModels.size(); index++) {
            slots.add(new EnvSlot(
                    "nvidia-" + (index + 1),
                    "nvidia",
                    "NVIDIA NIM " + (index + 1),
                    nvidiaEnabled,
                    nvidiaModels.get(index),
                    nvidiaBaseUrl,
                    nvidiaApiKey,
                    nvidiaTimeoutSeconds,
                    0,
                    LlmRuntimeSlot.LlmRuntimeSlotKind.OPENAI_COMPAT
            ));
        }
        slots.add(new EnvSlot(
                "openrouter-primary",
                "openrouter",
                "OpenRouter primary",
                primaryEnabled,
                primaryModelName,
                primaryBaseUrl,
                primaryApiKey,
                primaryTimeoutSeconds,
                primaryMaxRetries,
                LlmRuntimeSlot.LlmRuntimeSlotKind.OPENAI_COMPAT
        ));
        String effectiveFallbackKey = hasUsableApiKey(fallbackApiKey) ? fallbackApiKey : primaryApiKey;
        slots.add(new EnvSlot(
                "openrouter-fallback",
                "openrouter",
                "OpenRouter fallback",
                fallbackEnabled,
                fallbackModelName,
                fallbackBaseUrl,
                effectiveFallbackKey,
                fallbackTimeoutSeconds,
                fallbackMaxRetries,
                LlmRuntimeSlot.LlmRuntimeSlotKind.OPENAI_COMPAT
        ));
        slots.add(new EnvSlot(
                "openrouter-free-router",
                "openrouter",
                "OpenRouter free router",
                freeRouterEnabled,
                freeRouterModelName,
                primaryBaseUrl,
                primaryApiKey,
                primaryTimeoutSeconds,
                primaryMaxRetries,
                LlmRuntimeSlot.LlmRuntimeSlotKind.OPENAI_COMPAT
        ));
        String resolvedOllamaUrl = ollamaChatEnabled
                ? OllamaEndpointResolver.resolve(ollamaBaseUrl)
                : ollamaBaseUrl;
        slots.add(new EnvSlot(
                "ollama",
                "ollama",
                "Ollama local fallback",
                ollamaChatEnabled,
                ollamaChatModelName,
                resolvedOllamaUrl,
                "",
                ollamaChatTimeoutSeconds,
                0,
                LlmRuntimeSlot.LlmRuntimeSlotKind.OLLAMA
        ));
        return slots;
    }

    private LlmProviderConfigView toView(EnvSlot slot, LlmProviderOverride override) {
        boolean adminDeleted = override != null && Boolean.TRUE.equals(override.getDeleted());
        boolean effectiveEnabled = isEffectiveEnabled(slot, override);
        return LlmProviderConfigView.builder()
                .providerId(slot.providerId())
                .family(slot.family())
                .label(slot.label())
                .envModel(slot.envModel())
                .effectiveModel(effectiveModel(slot, override))
                .envEnabled(slot.envEnabled())
                .effectiveEnabled(effectiveEnabled)
                .adminDeleted(adminDeleted)
                .adminEnabledOverride(override == null ? null : override.getEnabled())
                .adminModelOverride(override == null ? null : override.getModel())
                .apiKeyConfigured(slot.kind() == LlmRuntimeSlot.LlmRuntimeSlotKind.OLLAMA || hasUsableApiKey(slot.apiKey()))
                .baseUrl(slot.baseUrl())
                .timeoutSeconds(slot.timeoutSeconds())
                .updatedAt(override == null ? null : override.getUpdatedAt())
                .updatedBy(override == null ? null : override.getUpdatedBy())
                .build();
    }

    private LlmRuntimeSlot toRuntimeSlot(EnvSlot slot, LlmProviderOverride override) {
        return new LlmRuntimeSlot(
                slot.providerId(),
                slot.family(),
                slot.label(),
                effectiveModel(slot, override),
                slot.baseUrl(),
                slot.apiKey(),
                slot.timeoutSeconds(),
                slot.maxRetries(),
                slot.kind()
        );
    }

    private boolean isEffectiveEnabled(EnvSlot slot, LlmProviderOverride override) {
        if (override != null && Boolean.TRUE.equals(override.getDeleted())) {
            return false;
        }
        if (!slot.envEnabled()) {
            return false;
        }
        if (override != null && override.getEnabled() != null) {
            return override.getEnabled();
        }
        if (slot.kind() == LlmRuntimeSlot.LlmRuntimeSlotKind.OLLAMA) {
            return hasText(effectiveModel(slot, override));
        }
        return hasUsableApiKey(slot.apiKey()) && hasText(slot.baseUrl()) && hasText(effectiveModel(slot, override));
    }

    private String effectiveModel(EnvSlot slot, LlmProviderOverride override) {
        if (override != null && hasText(override.getModel())) {
            return override.getModel().trim();
        }
        return slot.envModel();
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

    private boolean hasText(String value) {
        return value != null && !value.isBlank();
    }

    private boolean hasUsableApiKey(String value) {
        return hasText(value) && !value.toLowerCase(Locale.ROOT).startsWith("missing-");
    }

    private String trim(String value) {
        return value == null ? null : value.trim();
    }
}
