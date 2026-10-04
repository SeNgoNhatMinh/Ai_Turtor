package com.ragapi.service;

import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;

class OpenRouterChatServiceTest {

    @Test
    void keepsOllamaAsTheLastFallbackWhenTheProviderChainIsCapped() {
        List<LlmRuntimeSlot> available = List.of(
                cloud("groq-4"),
                cloud("nvidia-1"),
                cloud("openrouter-primary"),
                cloud("openrouter-fallback"),
                cloud("openrouter-free-router"),
                ollama()
        );

        List<LlmRuntimeSlot> selected = OpenRouterChatService.selectRuntimeSlots(available, 5);

        assertEquals(
                List.of("groq-4", "nvidia-1", "openrouter-primary", "openrouter-fallback", "ollama"),
                selected.stream().map(LlmRuntimeSlot::providerId).toList()
        );
    }

    @Test
    void usesOllamaWhenOnlyOneAttemptIsAllowed() {
        List<LlmRuntimeSlot> selected = OpenRouterChatService.selectRuntimeSlots(
                List.of(cloud("groq-4"), ollama()),
                1
        );

        assertEquals(List.of("ollama"), selected.stream().map(LlmRuntimeSlot::providerId).toList());
    }

    @Test
    void preservesConfiguredOrderWhenTheChainDoesNotNeedCapping() {
        List<LlmRuntimeSlot> available = List.of(cloud("groq-4"), ollama());

        assertEquals(available, OpenRouterChatService.selectRuntimeSlots(available, 5));
    }

    private LlmRuntimeSlot cloud(String providerId) {
        return new LlmRuntimeSlot(
                providerId,
                "cloud",
                providerId,
                providerId + "-model",
                "https://example.test/v1",
                "key",
                15,
                0,
                LlmRuntimeSlot.LlmRuntimeSlotKind.OPENAI_COMPAT
        );
    }

    private LlmRuntimeSlot ollama() {
        return new LlmRuntimeSlot(
                "ollama",
                "ollama",
                "Ollama local fallback",
                "gemma3:4b",
                "http://localhost:11434",
                "",
                120,
                0,
                LlmRuntimeSlot.LlmRuntimeSlotKind.OLLAMA
        );
    }
}
