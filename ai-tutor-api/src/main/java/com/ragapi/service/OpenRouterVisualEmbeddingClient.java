package com.ragapi.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.Base64;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class OpenRouterVisualEmbeddingClient {

    private final ObjectMapper objectMapper;

    @Value("${rag.visual.enabled:false}") private boolean enabled;
    @Value("${rag.visual.openrouter.api-key:}") private String apiKey;
    @Value("${rag.visual.openrouter.base-url:https://openrouter.ai/api/v1}") private String baseUrl;
    @Value("${rag.visual.openrouter.model:nvidia/llama-nemotron-embed-vl-1b-v2:free}") private String model;
    @Value("${rag.visual.openrouter.timeout-seconds:90}") private int timeoutSeconds;
    @Value("${rag.visual.openrouter.max-retries:2}") private int maxRetries;

    public boolean isEnabled() { return enabled && apiKey != null && !apiKey.isBlank(); }
    public String model() { return model; }

    public float[] embedPng(byte[] png, String caption) {
        if (!isEnabled()) throw new IllegalStateException("Visual embedding is disabled or API key is missing");
        try {
            String dataUrl = "data:image/png;base64," + Base64.getEncoder().encodeToString(png);
            Map<String, Object> image = Map.of("type", "image_url", "image_url", Map.of("url", dataUrl));
            Map<String, Object> text = Map.of("type", "text", "text", caption == null ? "Course material page" : caption);
            Map<String, Object> input = Map.of("content", List.of(text, image));
            byte[] body = objectMapper.writeValueAsBytes(Map.of(
                    "model", model,
                    "input", List.of(input),
                    "input_type", "passage",
                    "encoding_format", "float"
            ));
            HttpClient client = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(timeoutSeconds)).build();
            HttpRequest request = HttpRequest.newBuilder(URI.create(stripSlash(baseUrl) + "/embeddings"))
                    .timeout(Duration.ofSeconds(timeoutSeconds))
                    .header("Authorization", "Bearer " + apiKey.trim())
                    .header("Content-Type", "application/json")
                    .header("HTTP-Referer", "https://localhost/ai-tutor")
                    .header("X-Title", "FPT AI Tutor")
                    .POST(HttpRequest.BodyPublishers.ofByteArray(body)).build();
            HttpResponse<String> response = null;
            for (int attempt = 0; attempt <= Math.max(0, maxRetries); attempt++) {
                response = client.send(request, HttpResponse.BodyHandlers.ofString());
                if (response.statusCode() >= 200 && response.statusCode() < 300) break;
                if ((response.statusCode() != 429 && response.statusCode() < 500) || attempt == maxRetries) {
                    throw new IllegalStateException("Visual embedding HTTP " + response.statusCode());
                }
                Thread.sleep(Math.min(8000L, 1000L << attempt));
            }
            JsonNode vector = objectMapper.readTree(response.body()).path("data").path(0).path("embedding");
            if (!vector.isArray() || vector.isEmpty()) throw new IllegalStateException("Visual embedding returned no vector");
            float[] result = new float[vector.size()];
            for (int i = 0; i < vector.size(); i++) result[i] = (float) vector.get(i).asDouble();
            return result;
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException("Visual embedding interrupted", e);
        } catch (Exception e) {
            throw new IllegalStateException("Visual embedding failed: " + e.getMessage(), e);
        }
    }

    private String stripSlash(String value) {
        String result = value == null ? "" : value.trim();
        while (result.endsWith("/")) result = result.substring(0, result.length() - 1);
        return result;
    }
}
