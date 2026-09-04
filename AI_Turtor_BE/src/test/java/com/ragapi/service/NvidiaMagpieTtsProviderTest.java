package com.ragapi.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.web.client.RestClient;

import java.io.IOException;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicReference;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class NvidiaMagpieTtsProviderTest {

    private HttpServer server;

    @AfterEach
    void stopServer() {
        if (server != null) server.stop(0);
    }

    @Test
    void listsOnlyVietnameseVoicesCachesThemAndSendsMultipartSynthesis() throws Exception {
        AtomicInteger listCalls = new AtomicInteger();
        AtomicReference<String> synthesisBody = new AtomicReference<>();
        server = HttpServer.create(new InetSocketAddress(0), 0);
        server.createContext("/v1/audio/list_voices", exchange -> {
            listCalls.incrementAndGet();
            assertEquals("Bearer test-key", exchange.getRequestHeaders().getFirst("Authorization"));
            json(exchange, 200, """
                    {"en-US,vi-VN":{"voices":[
                      "Magpie-Multilingual.EN-US.Ava",
                      "Magpie-Multilingual.VI-VN.Nam.Neutral"
                    ]}}
                    """);
        });
        server.createContext("/v1/audio/synthesize", exchange -> {
            synthesisBody.set(new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8));
            byte[] pcm = new byte[]{1, 2, 3, 4};
            exchange.getResponseHeaders().set("Content-Type", "audio/L16");
            exchange.sendResponseHeaders(200, pcm.length);
            exchange.getResponseBody().write(pcm);
            exchange.close();
        });
        server.start();
        NvidiaMagpieTtsProvider provider = provider("test-key");

        assertEquals(1, provider.listVoices().size());
        assertEquals("Magpie-Multilingual.VI-VN.Nam.Neutral", provider.listVoices().get(0).id());
        assertEquals("Nam · Neutral", provider.listVoices().get(0).name());
        TtsProvider.GeneratedAudio audio = provider.synthesize(
                "Xin chào", "Magpie-Multilingual.VI-VN.Nam.Neutral", "vi-VN");

        assertEquals(1, listCalls.get());
        assertEquals("audio/wav", audio.contentType());
        assertEquals(48, audio.bytes().length);
        assertTrue(synthesisBody.get().contains("name=\"text\""));
        assertTrue(synthesisBody.get().contains("Xin chào"));
        assertTrue(synthesisBody.get().contains("name=\"sample_rate_hz\""));
        assertTrue(synthesisBody.get().contains("44100"));
    }

    @Test
    void failsClearlyWhenServerKeyIsMissing() {
        NvidiaMagpieTtsProvider provider = new NvidiaMagpieTtsProvider(
                RestClient.builder(), new ObjectMapper(), true, "nvidia-magpie", "",
                "http://localhost:1", "/v1/audio/list_voices", "/v1/audio/synthesize",
                "vi-VN", "LINEAR_PCM", 44_100, "", 30, 2);

        TtsUnavailableException error = assertThrows(TtsUnavailableException.class, provider::listVoices);

        assertTrue(error.getMessage().contains("NVIDIA_API_KEY"));
    }

    @Test
    void returnsRetryFriendlyMessageForProviderRateLimit() throws Exception {
        server = HttpServer.create(new InetSocketAddress(0), 0);
        server.createContext("/v1/audio/list_voices", exchange -> json(exchange, 200,
                "{\"voices\":[{\"voice_id\":\"vi-VN-Nam\",\"language\":\"vi-VN\"}]}"));
        server.createContext("/v1/audio/synthesize", exchange -> json(exchange, 429,
                "{\"error\":\"rate limited\"}"));
        server.start();
        NvidiaMagpieTtsProvider provider = provider("test-key");

        TtsUnavailableException error = assertThrows(TtsUnavailableException.class,
                () -> provider.synthesize("Xin chào", "vi-VN-Nam", "vi-VN"));

        assertTrue(error.getMessage().contains("thử lại"));
    }

    @Test
    void classifiesProviderNormalizedLengthErrorsForAdaptiveChunking() throws Exception {
        server = HttpServer.create(new InetSocketAddress(0), 0);
        server.createContext("/v1/audio/list_voices", exchange -> json(exchange, 200,
                "{\"voices\":[{\"voice_id\":\"vi-VN-Nam\",\"language\":\"vi-VN\"}]}"));
        server.createContext("/v1/audio/synthesize", exchange -> json(exchange, 400, """
                {"detail":"Input text is larger than the maximum input length: 2430 > 2000."}
                """));
        server.start();

        assertThrows(TtsChunkTooLargeException.class,
                () -> provider("test-key").synthesize("Nội dung dài", "vi-VN-Nam", "vi-VN"));
    }

    @Test
    void classifiesGeneratedAudioPayloadLimitForAdaptiveChunking() throws Exception {
        server = HttpServer.create(new InetSocketAddress(0), 0);
        server.createContext("/v1/audio/list_voices", exchange -> json(exchange, 200,
                "{\"voices\":[{\"voice_id\":\"vi-VN-Nam\",\"language\":\"vi-VN\"}]}"));
        server.createContext("/v1/audio/synthesize", exchange -> json(exchange, 400, """
                {"detail":"CLIENT: Received message larger than max (5939248 vs. 4194304)"}
                """));
        server.start();

        assertThrows(TtsChunkTooLargeException.class,
                () -> provider("test-key").synthesize("Nội dung dài", "vi-VN-Nam", "vi-VN"));
    }

    @Test
    void fallsBackToFirstVietnameseVoiceWhenRequestedVoiceIsInvalid() throws Exception {
        AtomicReference<String> synthesisBody = new AtomicReference<>();
        server = HttpServer.create(new InetSocketAddress(0), 0);
        server.createContext("/v1/audio/list_voices", exchange -> json(exchange, 200, """
                {"voices":[{"voice_id":"vi-VN-default","language":"vi-VN"}]}
                """));
        server.createContext("/v1/audio/synthesize", exchange -> {
            synthesisBody.set(new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8));
            byte[] pcm = new byte[]{1, 2};
            exchange.getResponseHeaders().set("Content-Type", "audio/L16");
            exchange.sendResponseHeaders(200, pcm.length);
            exchange.getResponseBody().write(pcm);
            exchange.close();
        });
        server.start();

        provider("test-key").synthesize("Xin chào", "voice-khong-ton-tai", "vi-VN");

        assertTrue(synthesisBody.get().contains("vi-VN-default"));
        assertFalse(synthesisBody.get().contains("voice-khong-ton-tai"));
    }

    private NvidiaMagpieTtsProvider provider(String key) {
        return new NvidiaMagpieTtsProvider(
                RestClient.builder(), new ObjectMapper(), true, "nvidia-magpie", key,
                "http://localhost:" + server.getAddress().getPort(),
                "/v1/audio/list_voices", "/v1/audio/synthesize",
                "vi-VN", "LINEAR_PCM", 44_100, "", 30, 2);
    }

    private void json(HttpExchange exchange, int status, String body) throws IOException {
        byte[] bytes = body.getBytes(StandardCharsets.UTF_8);
        exchange.getResponseHeaders().set("Content-Type", "application/json");
        exchange.sendResponseHeaders(status, bytes.length);
        exchange.getResponseBody().write(bytes);
        exchange.close();
    }
}
