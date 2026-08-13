package com.ragapi.service;

import com.ragapi.model.NvidiaEmbeddingModel;
import dev.langchain4j.data.embedding.Embedding;
import dev.langchain4j.model.embedding.EmbeddingModel;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class EmbeddingService {

    private final EmbeddingModel embeddingModel;
    private final PrivacySanitizer privacySanitizer;

    public Embedding generateEmbedding(String text) {
        return generateQueryEmbedding(text);
    }

    public Embedding generateQueryEmbedding(String text) {
        return generateEmbedding(text, true);
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
