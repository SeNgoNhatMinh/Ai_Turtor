package com.ragapi.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.ragapi.model.NvidiaEmbeddingModel;
import dev.langchain4j.model.embedding.EmbeddingModel;
import dev.langchain4j.model.ollama.OllamaEmbeddingModel;
import dev.langchain4j.model.openai.OpenAiChatModel;
import dev.langchain4j.model.openai.OpenAiEmbeddingModel;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.time.Duration;
import java.util.Locale;

@Configuration
public class OpenAIConfig {

    // =========================
    // OPENROUTER (OpenAI-compatible chat model)
    // =========================

    @Value("${openrouter.api-key}")
    private String openRouterApiKey;

    @Value("${openrouter.base-url}")
    private String openRouterBaseUrl;

    @Value("${openrouter.model}")
    private String openRouterModel;

    @Value("${openrouter.timeout-seconds:60}")
    private int openRouterTimeoutSeconds;

    @Value("${openrouter.max-retries:0}")
    private int openRouterMaxRetries;

    // =========================
    // OLLAMA (Embedding)
    // =========================

    @Value("${ollama.base-url}")
    private String ollamaBaseUrl;

    @Value("${ollama.embedding-model}")
    private String embeddingModel;

    @Value("${ollama.timeout-seconds:300}")
    private int ollamaTimeoutSeconds;

    @Value("${rag.embedding.provider:ollama}")
    private String embeddingProvider;

    @Value("${rag.embedding.openrouter.api-key:}")
    private String embeddingOpenRouterApiKey;

    @Value("${rag.embedding.openrouter.base-url:https://openrouter.ai/api/v1}")
    private String embeddingOpenRouterBaseUrl;

    @Value("${rag.embedding.openrouter.model:nvidia/llama-nemotron-embed-vl-1b-v2:free}")
    private String embeddingOpenRouterModel;

    @Value("${rag.embedding.openrouter.timeout-seconds:60}")
    private int embeddingOpenRouterTimeoutSeconds;

    @Value("${rag.embedding.openrouter.max-retries:0}")
    private int embeddingOpenRouterMaxRetries;

    @Value("${rag.embedding.nvidia.api-key:}")
    private String nvidiaEmbeddingApiKey;

    @Value("${rag.embedding.nvidia.base-url:https://integrate.api.nvidia.com/v1}")
    private String nvidiaEmbeddingBaseUrl;

    @Value("${rag.embedding.nvidia.model:nvidia/nemotron-3-embed-1b}")
    private String nvidiaEmbeddingModel;

    @Value("${rag.embedding.nvidia.timeout-seconds:30}")
    private int nvidiaEmbeddingTimeoutSeconds;

    @Value("${rag.embedding.nvidia.max-retries:3}")
    private int nvidiaEmbeddingMaxRetries;

    private final ObjectMapper objectMapper;

    public OpenAIConfig(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    // =========================
    // CHAT MODEL
    // =========================

    @Bean
    public OpenAiChatModel chatModel() {

        return OpenAiChatModel.builder()
                .apiKey(openRouterApiKey)
                .baseUrl(openRouterBaseUrl)
                .modelName(openRouterModel)
                .timeout(Duration.ofSeconds(openRouterTimeoutSeconds))
                .maxRetries(openRouterMaxRetries)
                .build();
    }

    // =========================
    // EMBEDDING MODEL
    // =========================

    @Bean
    public EmbeddingModel embeddingModel() {
        String provider = embeddingProvider == null
                ? "ollama"
                : embeddingProvider.trim().toLowerCase(Locale.ROOT);

        if ("openrouter".equals(provider)) {
            if (embeddingOpenRouterApiKey == null || embeddingOpenRouterApiKey.isBlank()) {
                throw new IllegalStateException("RAG embedding OpenRouter API key is required");
            }
            return OpenAiEmbeddingModel.builder()
                    .apiKey(embeddingOpenRouterApiKey)
                    .baseUrl(embeddingOpenRouterBaseUrl)
                    .modelName(embeddingOpenRouterModel)
                    .timeout(Duration.ofSeconds(embeddingOpenRouterTimeoutSeconds))
                    .maxRetries(embeddingOpenRouterMaxRetries)
                    .build();
        }

        if ("ollama".equals(provider)) {
            return OllamaEmbeddingModel.builder()
                    .baseUrl(ollamaBaseUrl)
                    .modelName(embeddingModel)
                    .timeout(Duration.ofSeconds(ollamaTimeoutSeconds))
                    .build();
        }

        if ("nvidia".equals(provider)) {
            return new NvidiaEmbeddingModel(
                    nvidiaEmbeddingApiKey,
                    nvidiaEmbeddingBaseUrl,
                    nvidiaEmbeddingModel,
                    Duration.ofSeconds(nvidiaEmbeddingTimeoutSeconds),
                    nvidiaEmbeddingMaxRetries,
                    objectMapper
            );
        }

        throw new IllegalStateException("Unsupported RAG embedding provider: " + embeddingProvider);
    }
}
