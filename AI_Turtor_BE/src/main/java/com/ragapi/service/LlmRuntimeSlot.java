package com.ragapi.service;

public record LlmRuntimeSlot(
        String providerId,
        String family,
        String label,
        String model,
        String baseUrl,
        String apiKey,
        int timeoutSeconds,
        int maxRetries,
        LlmRuntimeSlotKind kind
) {
    public enum LlmRuntimeSlotKind {
        OPENAI_COMPAT,
        OLLAMA
    }
}
