package com.ragapi.model;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import dev.langchain4j.data.embedding.Embedding;
import dev.langchain4j.data.segment.TextSegment;
import dev.langchain4j.model.embedding.EmbeddingModel;
import dev.langchain4j.model.output.Response;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/** NVIDIA NIM embedding adapter with the required query/passage distinction. */
public final class NvidiaEmbeddingModel implements EmbeddingModel {

    public static final String QUERY = "query";
    public static final String PASSAGE = "passage";

    private final String apiKey;
    private final String endpoint;
    private final String model;
    private final Duration timeout;
    private final int maxRetries;
    private final ObjectMapper objectMapper;
    private final HttpClient httpClient;

    public NvidiaEmbeddingModel(
            String apiKey,
            String baseUrl,
            String model,
            Duration timeout,
            int maxRetries,
            ObjectMapper objectMapper
    ) {
        if (apiKey == null || apiKey.isBlank()) {
            throw new IllegalStateException("NVIDIA embedding API key is required");
        }
        this.apiKey = apiKey.trim();
        this.endpoint = stripTrailingSlash(baseUrl) + "/embeddings";
        this.model = model;
        this.timeout = timeout;
        this.maxRetries = Math.max(0, maxRetries);
        this.objectMapper = objectMapper;
        this.httpClient = HttpClient.newBuilder().connectTimeout(timeout).build();
    }

    public Embedding embedQuery(String text) {
        return embedAll(List.of(text), QUERY).get(0);
    }

    public Embedding embedPassage(String text) {
        return embedAll(List.of(text), PASSAGE).get(0);
    }

    public List<Embedding> embedPassages(List<String> texts) {
        return embedAll(texts, PASSAGE);
    }

    private List<Embedding> embedAll(List<String> texts, String inputType) {
        try {
            byte[] body = objectMapper.writeValueAsBytes(Map.of(
                    "input", texts,
                    "model", model,
                    "input_type", inputType,
                    "modality", "text",
                    "encoding_format", "float",
                    "truncate", "END"
            ));
            HttpRequest request = HttpRequest.newBuilder(URI.create(endpoint))
                    .timeout(timeout)
                    .header("Authorization", "Bearer " + apiKey)
                    .header("Accept", "application/json")
                    .header("Content-Type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofByteArray(body))
                    .build();
            HttpResponse<String> response = null;
            for (int attempt = 0; attempt <= maxRetries; attempt++) {
                response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
                if (response.statusCode() >= 200 && response.statusCode() < 300) {
                    break;
                }
                boolean retryable = response.statusCode() == 429 || response.statusCode() >= 500;
                if (!retryable || attempt == maxRetries) {
                    throw new IllegalStateException("NVIDIA embedding HTTP " + response.statusCode());
                }
                Thread.sleep(Math.min(8_000L, 1_000L << attempt));
            }
            if (response == null) {
                throw new IllegalStateException("NVIDIA embedding returned no response");
            }
            JsonNode data = objectMapper.readTree(response.body()).path("data");
            if (!data.isArray() || data.size() != texts.size()) {
                throw new IllegalStateException("NVIDIA embedding response vector count mismatch");
            }
            List<Embedding> embeddings = new ArrayList<>(data.size());
            for (JsonNode item : data) {
                JsonNode embeddingNode = item.path("embedding");
                if (!embeddingNode.isArray() || embeddingNode.isEmpty()) {
                    throw new IllegalStateException("NVIDIA embedding response did not contain a vector");
                }
                float[] vector = new float[embeddingNode.size()];
                for (int i = 0; i < embeddingNode.size(); i++) {
                    vector[i] = (float) embeddingNode.get(i).asDouble();
                }
                embeddings.add(Embedding.from(vector));
            }
            return embeddings;
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException("NVIDIA embedding request interrupted", e);
        } catch (Exception e) {
            throw new IllegalStateException("NVIDIA embedding request failed: " + e.getMessage(), e);
        }
    }

    @Override
    public Response<List<Embedding>> embedAll(List<TextSegment> textSegments) {
        List<Embedding> embeddings = new ArrayList<>(textSegments.size());
        for (TextSegment segment : textSegments) {
            embeddings.add(embedQuery(segment.text()));
        }
        return Response.from(embeddings);
    }

    @Override
    public int dimension() {
        return 2048;
    }

    private static String stripTrailingSlash(String value) {
        String safe = value == null || value.isBlank() ? "https://integrate.api.nvidia.com/v1" : value.trim();
        while (safe.endsWith("/")) {
            safe = safe.substring(0, safe.length() - 1);
        }
        return safe;
    }
}
