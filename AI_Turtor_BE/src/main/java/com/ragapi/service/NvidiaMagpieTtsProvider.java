package com.ragapi.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;

import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

@Service
@Slf4j
public class NvidiaMagpieTtsProvider implements TtsProvider {

    private final RestClient restClient;
    private final ObjectMapper objectMapper;
    private final boolean enabled;
    private final String apiKey;
    private final String providerName;
    private final String listVoicesPath;
    private final String synthesisPath;
    private final String language;
    private final String encoding;
    private final int sampleRate;
    private final String configuredDefaultVoice;
    private final Duration voiceCacheTtl;
    private final Object voiceCacheLock = new Object();
    private volatile CachedVoices cachedVoices;

    public NvidiaMagpieTtsProvider(
            RestClient.Builder restClientBuilder,
            ObjectMapper objectMapper,
            @Value("${tts.enabled:false}") boolean enabled,
            @Value("${tts.provider:nvidia-magpie}") String providerName,
            @Value("${tts.nvidia.api-key:}") String apiKey,
            @Value("${tts.nvidia.base-url:https://877104f7-e885-42b9-8de8-f6e4c6303969.invocation.api.nvcf.nvidia.com}") String baseUrl,
            @Value("${tts.nvidia.list-voices-path:/v1/audio/list_voices}") String listVoicesPath,
            @Value("${tts.nvidia.synthesis-path:/v1/audio/synthesize}") String synthesisPath,
            @Value("${tts.nvidia.language:vi-VN}") String language,
            @Value("${tts.nvidia.encoding:LINEAR_PCM}") String encoding,
            @Value("${tts.nvidia.sample-rate:44100}") int sampleRate,
            @Value("${tts.nvidia.default-voice-id:}") String configuredDefaultVoice,
            @Value("${tts.nvidia.voice-cache-ttl-minutes:30}") long voiceCacheTtlMinutes,
            @Value("${tts.nvidia.timeout-seconds:90}") int timeoutSeconds
    ) {
        SimpleClientHttpRequestFactory requestFactory = new SimpleClientHttpRequestFactory();
        Duration timeout = Duration.ofSeconds(Math.max(1, timeoutSeconds));
        requestFactory.setConnectTimeout(timeout);
        requestFactory.setReadTimeout(timeout);
        this.restClient = restClientBuilder.baseUrl(trimTrailingSlash(baseUrl))
                .requestFactory(requestFactory)
                .build();
        this.objectMapper = objectMapper;
        this.enabled = enabled;
        this.providerName = safe(providerName);
        this.apiKey = safe(apiKey);
        this.listVoicesPath = listVoicesPath;
        this.synthesisPath = synthesisPath;
        this.language = safe(language).isBlank() ? "vi-VN" : safe(language);
        this.encoding = safe(encoding).isBlank() ? "LINEAR_PCM" : safe(encoding);
        this.sampleRate = Math.max(8_000, sampleRate);
        this.configuredDefaultVoice = safe(configuredDefaultVoice);
        this.voiceCacheTtl = Duration.ofMinutes(Math.max(1, voiceCacheTtlMinutes));
    }

    @Override
    public boolean isAvailable() {
        return enabled && "nvidia-magpie".equalsIgnoreCase(providerName) && !apiKey.isBlank();
    }

    @Override
    public List<Voice> listVoices() {
        requireAvailable();
        CachedVoices current = cachedVoices;
        if (current != null && current.expiresAt().isAfter(Instant.now())) return current.voices();
        synchronized (voiceCacheLock) {
            current = cachedVoices;
            if (current != null && current.expiresAt().isAfter(Instant.now())) return current.voices();
            try {
                JsonNode response = restClient.get()
                        .uri(listVoicesPath)
                        .header(HttpHeaders.AUTHORIZATION, bearer())
                        .retrieve()
                        .body(JsonNode.class);
                List<Voice> voices = parseVietnameseVoices(response);
                if (voices.isEmpty()) {
                    throw new TtsUnavailableException("NVIDIA Magpie did not return a Vietnamese voice");
                }
                cachedVoices = new CachedVoices(List.copyOf(voices), Instant.now().plus(voiceCacheTtl));
                return cachedVoices.voices();
            } catch (TtsUnavailableException error) {
                if (current != null && !current.voices().isEmpty()) return current.voices();
                throw error;
            } catch (RestClientResponseException error) {
                if (current != null && !current.voices().isEmpty()) return current.voices();
                throw providerError("list voices", error);
            } catch (RuntimeException error) {
                if (current != null && !current.voices().isEmpty()) return current.voices();
                log.warn("NVIDIA Magpie list voices failed: {}", error.getClass().getSimpleName());
                throw unavailable(error);
            }
        }
    }

    @Override
    public GeneratedAudio synthesize(String text, String requestedVoice, String requestedLanguage) {
        requireAvailable();
        String safeText = safe(text);
        if (safeText.isBlank()) throw new IllegalArgumentException("TTS text is required");
        List<Voice> voices = listVoices();
        String voice = resolveVoice(requestedVoice, voices);
        String targetLanguage = safe(requestedLanguage).isBlank() ? language : safe(requestedLanguage);

        MultiValueMap<String, Object> body = new LinkedMultiValueMap<>();
        body.add("text", safeText);
        body.add("language", targetLanguage);
        body.add("voice", voice);
        body.add("encoding", encoding);
        body.add("sample_rate_hz", Integer.toString(sampleRate));
        try {
            ResponseEntity<byte[]> response = restClient.post()
                    .uri(synthesisPath)
                    .header(HttpHeaders.AUTHORIZATION, bearer())
                    .contentType(MediaType.MULTIPART_FORM_DATA)
                    .body(body)
                    .retrieve()
                    .toEntity(byte[].class);
            byte[] audio = extractAudio(response.getBody(), response.getHeaders().getContentType());
            return new GeneratedAudio(WavAudioUtils.ensurePcmWav(audio, sampleRate), "audio/wav");
        } catch (RestClientResponseException error) {
            throw providerError("synthesize", error);
        } catch (TtsUnavailableException | IllegalArgumentException error) {
            throw error;
        } catch (RuntimeException error) {
            log.warn("NVIDIA Magpie synthesize failed: {}", error.getClass().getSimpleName());
            throw unavailable(error);
        }
    }

    private List<Voice> parseVietnameseVoices(JsonNode response) {
        List<JsonNode> items = new ArrayList<>();
        collectVoiceItems(response, items);
        if (items.isEmpty()) return List.of();

        Map<String, Voice> unique = new LinkedHashMap<>();
        for (JsonNode item : items) {
            String id;
            String itemLanguage;
            String name;
            String description;
            if (item.isTextual()) {
                id = item.asText("").trim();
                itemLanguage = languageFromId(id);
                name = displayNameFromId(id);
                description = "";
            } else {
                id = firstText(item, "voice_id", "voiceId", "id", "name", "voice");
                itemLanguage = firstText(item, "language", "language_code", "languageCode", "locale");
                if (itemLanguage.isBlank()) itemLanguage = matchingLanguage(item.get("languages"));
                if (itemLanguage.isBlank()) itemLanguage = languageFromId(id);
                name = firstText(item, "display_name", "displayName", "label");
                if (name.isBlank()) name = displayNameFromId(id);
                description = firstText(item, "description", "gender", "style");
            }
            if (!id.isBlank() && isVietnamese(id, itemLanguage)) {
                unique.putIfAbsent(id, new Voice(id, name, normalizeLanguage(itemLanguage), description));
            }
        }
        return new ArrayList<>(unique.values());
    }

    private void collectVoiceItems(JsonNode node, List<JsonNode> result) {
        if (node == null || node.isNull()) return;
        if (node.isArray()) {
            node.forEach(result::add);
            return;
        }
        if (!node.isObject()) return;
        for (String field : List.of("voices", "data", "items")) {
            JsonNode child = node.get(field);
            if (child != null && child.isArray()) {
                child.forEach(result::add);
                return;
            }
        }
        node.elements().forEachRemaining(child -> collectVoiceItems(child, result));
    }

    private String resolveVoice(String requestedVoice, List<Voice> voices) {
        String requested = safe(requestedVoice);
        if (!requested.isBlank() && voices.stream().anyMatch(voice -> voice.id().equals(requested))) {
            return requested;
        }
        if (!requested.isBlank()) log.warn("NVIDIA Magpie voice is no longer available; using default voice");
        if (!configuredDefaultVoice.isBlank()
                && voices.stream().anyMatch(voice -> voice.id().equals(configuredDefaultVoice))) {
            return configuredDefaultVoice;
        }
        return voices.get(0).id();
    }

    private byte[] extractAudio(byte[] body, MediaType contentType) {
        if (body == null || body.length == 0) throw new TtsUnavailableException("NVIDIA Magpie returned empty audio");
        boolean json = contentType != null && MediaType.APPLICATION_JSON.isCompatibleWith(contentType);
        if (!json && body.length > 0 && body[0] != '{') return body;
        try {
            JsonNode node = objectMapper.readTree(new String(body, StandardCharsets.UTF_8));
            String encoded = firstText(node, "audio", "audioContent", "audio_content", "data");
            if (encoded.startsWith("data:")) encoded = encoded.substring(encoded.indexOf(',') + 1);
            if (encoded.isBlank()) throw new TtsUnavailableException("NVIDIA Magpie response did not contain audio");
            return Base64.getDecoder().decode(encoded);
        } catch (TtsUnavailableException error) {
            throw error;
        } catch (Exception error) {
            throw new TtsUnavailableException("Cannot decode NVIDIA Magpie audio response", error);
        }
    }

    private TtsUnavailableException providerError(String operation, RestClientResponseException error) {
        int status = error.getStatusCode().value();
        log.warn("NVIDIA Magpie {} failed with HTTP {}", operation, status);
        if (status == 400 && isProviderChunkTooLarge(error)) {
            return new TtsChunkTooLargeException(
                    "NVIDIA Magpie rejected a chunk that exceeded an internal payload limit", error);
        }
        if (status == 429) {
            return new TtsUnavailableException("Dịch vụ giọng đọc đang bận. Vui lòng thử lại sau ít phút.", error);
        }
        if (status == 401 || status == 403) {
            return new TtsUnavailableException("NVIDIA Magpie authentication is not configured correctly", error);
        }
        return unavailable(error);
    }

    private boolean isProviderChunkTooLarge(RestClientResponseException error) {
        String responseBody = safe(error.getResponseBodyAsString()).toLowerCase(Locale.ROOT);
        return responseBody.contains("maximum input length")
                || responseBody.contains("input text is larger")
                || responseBody.contains("message larger than max");
    }

    private void requireAvailable() {
        if (!enabled) throw new TtsUnavailableException("TTS is disabled");
        if (!"nvidia-magpie".equalsIgnoreCase(providerName)) {
            throw new TtsUnavailableException("Unsupported TTS provider: " + providerName);
        }
        if (apiKey.isBlank()) throw new TtsUnavailableException("NVIDIA_API_KEY is not configured");
    }

    private TtsUnavailableException unavailable(Throwable cause) {
        return new TtsUnavailableException("Không thể tạo giọng đọc lúc này. Vui lòng thử lại sau.", cause);
    }

    private String bearer() {
        return "Bearer " + apiKey;
    }

    private boolean isVietnamese(String id, String itemLanguage) {
        String target = language.toUpperCase(Locale.ROOT);
        String normalizedLanguage = safe(itemLanguage).replace('_', '-').toUpperCase(Locale.ROOT);
        String normalizedId = safe(id).replace('_', '-').toUpperCase(Locale.ROOT);
        return target.equals(normalizedLanguage) || normalizedLanguage.startsWith("VI-")
                || normalizedId.contains("VI-VN");
    }

    private String normalizeLanguage(String value) {
        return safe(value).isBlank() ? language : safe(value).replace('_', '-');
    }

    private String matchingLanguage(JsonNode languages) {
        if (languages == null || !languages.isArray()) return "";
        for (JsonNode candidate : languages) {
            String value = candidate.isTextual() ? candidate.asText() : firstText(candidate, "language", "code", "locale");
            if (value.toUpperCase(Locale.ROOT).startsWith("VI")) return value;
        }
        return "";
    }

    private String languageFromId(String id) {
        return safe(id).replace('_', '-').toUpperCase(Locale.ROOT).contains("VI-VN") ? "vi-VN" : "";
    }

    private String displayNameFromId(String id) {
        String value = safe(id);
        if (value.isBlank()) return "Giọng NVIDIA";
        String[] parts = value.split("[./]");
        for (int index = 0; index < parts.length; index++) {
            if (parts[index].replace('_', '-').toUpperCase(Locale.ROOT).matches("[A-Z]{2}-[A-Z]{2}")) {
                StringBuilder name = new StringBuilder();
                for (int nameIndex = index + 1; nameIndex < parts.length; nameIndex++) {
                    if (!name.isEmpty()) name.append(" · ");
                    name.append(parts[nameIndex].replace('-', ' ').replace('_', ' '));
                }
                if (!name.isEmpty()) return name.toString();
            }
        }
        return parts.length == 0 ? value : parts[parts.length - 1].replace('-', ' ').replace('_', ' ');
    }

    private String firstText(JsonNode node, String... fields) {
        if (node == null) return "";
        for (String field : fields) {
            JsonNode value = node.get(field);
            if (value != null && value.isValueNode()) {
                String text = value.asText("").trim();
                if (!text.isBlank()) return text;
            }
        }
        return "";
    }

    private String trimTrailingSlash(String value) {
        String safe = safe(value);
        while (safe.endsWith("/")) safe = safe.substring(0, safe.length() - 1);
        return safe;
    }

    private String safe(String value) {
        return value == null ? "" : value.trim();
    }

    private record CachedVoices(List<Voice> voices, Instant expiresAt) {
    }
}
