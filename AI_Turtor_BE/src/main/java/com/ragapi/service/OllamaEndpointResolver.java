package com.ragapi.service;

import lombok.extern.slf4j.Slf4j;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.concurrent.atomic.AtomicReference;

/**
 * Picks a reachable Ollama base URL so Docker-oriented defaults
 * ({@code host.docker.internal}) still work when the Backend runs on the host.
 */
@Slf4j
final class OllamaEndpointResolver {

    private static final Duration PROBE_TIMEOUT = Duration.ofSeconds(2);
    private static final long CACHE_TTL_MS = 30_000L;
    private static final AtomicReference<CachedEndpoint> CACHE = new AtomicReference<>();

    private OllamaEndpointResolver() {
    }

    static String resolve(String configuredBaseUrl) {
        String primary = normalize(configuredBaseUrl);
        CachedEndpoint cached = CACHE.get();
        if (cached != null
                && cached.configuredEquals(primary)
                && (System.currentTimeMillis() - cached.resolvedAtMs()) < CACHE_TTL_MS) {
            return cached.resolvedUrl();
        }

        List<String> candidates = candidates(configuredBaseUrl);
        HttpClient client = HttpClient.newBuilder()
                .connectTimeout(PROBE_TIMEOUT)
                .build();
        for (String candidate : candidates) {
            if (isReachable(client, candidate)) {
                if (primary == null || !candidate.equals(primary)) {
                    log.info("Ollama endpoint resolved to {} (configured={})", candidate, configuredBaseUrl);
                }
                CACHE.set(new CachedEndpoint(primary, candidate, System.currentTimeMillis()));
                return candidate;
            }
        }
        String fallback = candidates.isEmpty() ? "http://127.0.0.1:11434" : candidates.get(0);
        log.warn("Ollama endpoint probe failed for {}; using {} anyway", candidates, fallback);
        CACHE.set(new CachedEndpoint(primary, fallback, System.currentTimeMillis()));
        return fallback;
    }

    static List<String> candidates(String configuredBaseUrl) {
        Set<String> ordered = new LinkedHashSet<>();
        String primary = normalize(configuredBaseUrl);
        if (primary != null) {
            ordered.add(primary);
        }
        ordered.add("http://127.0.0.1:11434");
        ordered.add("http://localhost:11434");
        if (primary != null && primary.contains("host.docker.internal")) {
            ordered.add(primary.replace("host.docker.internal", "127.0.0.1"));
            ordered.add(primary.replace("host.docker.internal", "localhost"));
        }
        return new ArrayList<>(ordered);
    }

    static void clearCacheForTests() {
        CACHE.set(null);
    }

    private static boolean isReachable(HttpClient client, String baseUrl) {
        try {
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(trimSlash(baseUrl) + "/api/tags"))
                    .timeout(PROBE_TIMEOUT)
                    .GET()
                    .build();
            HttpResponse<Void> response = client.send(request, HttpResponse.BodyHandlers.discarding());
            return response.statusCode() >= 200 && response.statusCode() < 500;
        } catch (Exception ignored) {
            return false;
        }
    }

    private static String normalize(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        if (trimmed.isEmpty()) {
            return null;
        }
        return trimSlash(trimmed).toLowerCase(Locale.ROOT).startsWith("http")
                ? trimSlash(trimmed)
                : null;
    }

    private static String trimSlash(String value) {
        if (value.endsWith("/")) {
            return value.substring(0, value.length() - 1);
        }
        return value;
    }

    private record CachedEndpoint(String configuredUrl, String resolvedUrl, long resolvedAtMs) {
        boolean configuredEquals(String configured) {
            if (configuredUrl == null) {
                return configured == null;
            }
            return configuredUrl.equals(configured);
        }
    }
}
