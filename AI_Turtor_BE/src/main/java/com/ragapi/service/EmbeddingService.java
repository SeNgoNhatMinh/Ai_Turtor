package com.ragapi.service;

import com.ragapi.model.NvidiaEmbeddingModel;
import dev.langchain4j.data.embedding.Embedding;
import dev.langchain4j.model.embedding.EmbeddingModel;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.slf4j.MDC;

import java.time.Duration;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@Slf4j
@Service
@RequiredArgsConstructor
public class EmbeddingService {

    private static final String QUERY_EMBEDDING_CACHE = "query-embedding";

    private final ThreadLocal<RequestEmbeddingMemo> requestMemo = new ThreadLocal<>();

    private final EmbeddingModel embeddingModel;
    private final PrivacySanitizer privacySanitizer;
    private final SharedRedisCacheService sharedRedisCache;

    @Value("${rag.embedding.provider:ollama}")
    private String embeddingProvider;

    @Value("${rag.embedding.openrouter.model:}")
    private String openRouterEmbeddingModel;

    @Value("${rag.embedding.nvidia.model:}")
    private String nvidiaEmbeddingModel;

    @Value("${ollama.embedding-model:embeddinggemma}")
    private String ollamaEmbeddingModel;

    @Value("${app.redis-cache.query-embedding-ttl-hours:168}")
    private long queryEmbeddingTtlHours;

    public Embedding generateEmbedding(String text) {
        return generateQueryEmbedding(text);
    }

    public Embedding generateQueryEmbedding(String text) {
        return generateEmbedding(text, true);
    }

    /** Returns the embedding already prepared earlier in this traced HTTP request, if any. */
    public Optional<Embedding> findRequestQueryEmbedding(String text) {
        String sanitized = validateAndSanitize(text);
        return findMemoized(embeddingCacheIdentity() + "|" + sanitized);
    }

    public void clearRequestMemo() {
        requestMemo.remove();
    }

    public Embedding generatePassageEmbedding(String text) {
        return generateEmbedding(text, false);
    }

    public List<Embedding> generatePassageEmbeddings(List<String> texts) {
        if (texts == null || texts.isEmpty()) {
            return List.of();
        }
        List<String> sanitized = new ArrayList<>(texts.size());
        for (String text : texts) {
            sanitized.add(validateAndSanitize(text));
        }
        try {
            if (embeddingModel instanceof NvidiaEmbeddingModel nvidia) {
                List<Embedding> embeddings = nvidia.embedPassages(sanitized);
                log.info("Generated {} passage embeddings in one NVIDIA batch", embeddings.size());
                return embeddings;
            }
            List<Embedding> embeddings = new ArrayList<>(sanitized.size());
            for (String text : sanitized) {
                embeddings.add(embeddingModel.embed(text).content());
            }
            return embeddings;
        } catch (Exception e) {
            log.error("Failed to generate passage embedding batch: {}", e.getMessage(), e);
            throw new RuntimeException("Failed to generate passage embedding batch", e);
        }
    }

    private Embedding generateEmbedding(String text, boolean query) {
        text = validateAndSanitize(text);
        if (!query) {
            return embedUncached(text, false);
        }
        String cacheKey = embeddingCacheIdentity() + "|" + text;
        Optional<Embedding> memoized = findMemoized(cacheKey);
        if (memoized.isPresent()) {
            return memoized.get();
        }
        float[] cached = sharedRedisCache.get(QUERY_EMBEDDING_CACHE, cacheKey, float[].class)
                .orElse(null);
        if (cached != null && cached.length > 0) {
            Embedding embedding = Embedding.from(cached);
            memoize(cacheKey, embedding);
            return embedding;
        }
        Embedding generated = embedUncached(text, true);
        sharedRedisCache.put(
                QUERY_EMBEDDING_CACHE,
                cacheKey,
                generated.vector(),
                Duration.ofHours(Math.max(1L, queryEmbeddingTtlHours))
        );
        memoize(cacheKey, generated);
        return generated;
    }

    private Optional<Embedding> findMemoized(String cacheKey) {
        String traceId = MDC.get("traceId");
        if (traceId == null || traceId.isBlank()) return Optional.empty();
        RequestEmbeddingMemo memo = requestMemo.get();
        if (memo == null || !traceId.equals(memo.traceId())) {
            requestMemo.set(new RequestEmbeddingMemo(traceId, new HashMap<>()));
            return Optional.empty();
        }
        return Optional.ofNullable(memo.embeddings().get(cacheKey));
    }

    private void memoize(String cacheKey, Embedding embedding) {
        String traceId = MDC.get("traceId");
        if (traceId == null || traceId.isBlank() || embedding == null) return;
        RequestEmbeddingMemo memo = requestMemo.get();
        if (memo == null || !traceId.equals(memo.traceId())) {
            memo = new RequestEmbeddingMemo(traceId, new HashMap<>());
            requestMemo.set(memo);
        }
        memo.embeddings().put(cacheKey, embedding);
    }

    private record RequestEmbeddingMemo(String traceId, Map<String, Embedding> embeddings) {
    }

    private String embeddingCacheIdentity() {
        String provider = embeddingProvider == null ? "" : embeddingProvider.trim().toLowerCase();
        String model = switch (provider) {
            case "openrouter" -> openRouterEmbeddingModel;
            case "nvidia" -> nvidiaEmbeddingModel;
            default -> ollamaEmbeddingModel;
        };
        return provider + "|" + (model == null ? "" : model.trim());
    }

    private Embedding embedUncached(String text, boolean query) {
        try {
            log.info("Generating embedding for text length: {}", text.length());

            Embedding embedding = embeddingModel instanceof NvidiaEmbeddingModel nvidia
                    ? (query ? nvidia.embedQuery(text) : nvidia.embedPassage(text))
                    : embeddingModel.embed(text).content();

            log.info("Embedding generated successfully with dimensions: {}", embedding.vector().length);
            return embedding;
        } catch (Exception e) {
            log.error("Failed to generate embedding: {}", e.getMessage(), e);
            throw new RuntimeException("Failed to generate embedding", e);
        }
    }

    private String validateAndSanitize(String text) {

        // Validate input
        if (text == null) {
            log.error("Embedding text is null");
            throw new IllegalArgumentException(
                    "Embedding text cannot be null"
            );
        }

        // Remove extra spaces
        text = privacySanitizer.sanitize(text.trim());

        // Validate empty text
        if (text.isEmpty()) {
            log.error("Embedding text is empty");
            throw new IllegalArgumentException(
                    "Embedding text cannot be empty"
            );
        }

        return text;
    }
}



