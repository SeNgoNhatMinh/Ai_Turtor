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
        // Prefer compose service DNS before loopback (loopback inside a container is wrong).
        ordered.add("http://ollama:11434");
        ordered.add("http://host.docker.internal:11434");
        boolean configuredIsLoopback = primary != null && (primary.contains("127.0.0.1") || primary.contains("localhost"));
        if (configuredIsLoopback || primary == null) {
            ordered.add("http://127.0.0.1:11434");
            ordered.add("http://localhost:11434");
        }
        if (primary != null && primary.contains("host.docker.internal")) {
            ordered.add(primary.replace("host.docker.internal", "ollama"));
        }
        return new ArrayList<>(ordered);
    }

    static java.util.Optional<Set<String>> listInstalledModels(String baseUrl) {
        String resolved = resolve(baseUrl);
        try {
            HttpClient client = HttpClient.newBuilder()
                    .connectTimeout(PROBE_TIMEOUT)
                    .build();
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(trimSlash(resolved) + "/api/tags"))
                    .timeout(PROBE_TIMEOUT)
                    .GET()
                    .build();
            HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() < 200 || response.statusCode() >= 300 || response.body() == null) {
                return java.util.Optional.empty();
            }
            Set<String> names = new LinkedHashSet<>();
            // Lightweight parse: "name":"model:tag"
            java.util.regex.Matcher matcher = java.util.regex.Pattern
                    .compile("\"name\"\\s*:\\s*\"([^\"]+)\"")
                    .matcher(response.body());
            while (matcher.find()) {
                names.add(matcher.group(1));
            }
            return java.util.Optional.of(names);
        } catch (Exception error) {
            log.warn("Failed to list Ollama models from {}: {}", resolved, error.getMessage());
            return java.util.Optional.empty();
        }
    }

    static boolean isModelInstalled(String baseUrl, String modelName) {
        if (modelName == null || modelName.isBlank()) {
            return false;
        }
        return listInstalledModels(baseUrl)
                .map(models -> models.stream().anyMatch(name -> name.equalsIgnoreCase(modelName.trim())))
                .orElse(true); // if probe fails, do not block admin updates
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
