package com.ragapi.model;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.sun.net.httpserver.HttpServer;
import dev.langchain4j.data.embedding.Embedding;
import org.junit.jupiter.api.Test;

import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.List;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicInteger;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

class NvidiaEmbeddingModelTest {

    @Test
    void sendsOnePassagePerRequestWhenTheEndpointRejectsBatches() throws Exception {
        AtomicInteger calls = new AtomicInteger();
        HttpServer server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/embeddings", exchange -> {
            calls.incrementAndGet();
            String request = new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8);
            int inputs = new ObjectMapper().readTree(request).path("input").size();
            byte[] body = inputs == 1
                    ? "{\"data\":[{\"embedding\":[0.25,0.5]}]}".getBytes(StandardCharsets.UTF_8)
                    : "{\"message\":\"service inference failed\"}".getBytes(StandardCharsets.UTF_8);
            exchange.sendResponseHeaders(inputs == 1 ? 200 : 500, body.length);
            exchange.getResponseBody().write(body);
            exchange.close();
        });
        server.start();
        try {
            NvidiaEmbeddingModel model = new NvidiaEmbeddingModel(
                    "test-key",
                    "http://127.0.0.1:" + server.getAddress().getPort(),
                    "nvidia/nemotron-3.5-embed-1b",
                    Duration.ofSeconds(5),
                    0,
                    new ObjectMapper()
            );

            List<Embedding> embeddings = model.embedPassages(List.of("one", "two"));

            assertEquals(3, calls.get());
            assertEquals(2, embeddings.size());
            assertEquals(0.25f, embeddings.get(0).vector()[0]);
        } finally {
            server.stop(0);
        }
    }

    @Test
    void sendsABatchInOneRequestWhenTheEndpointAcceptsIt() throws Exception {
        AtomicInteger calls = new AtomicInteger();
        HttpServer server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/embeddings", exchange -> {
            calls.incrementAndGet();
            String request = new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8);
            int inputs = new ObjectMapper().readTree(request).path("input").size();
            StringBuilder json = new StringBuilder("{\"data\":[");
            for (int i = 0; i < inputs; i++) {
                if (i > 0) {
                    json.append(',');
                }
                json.append("{\"embedding\":[0.25,0.5]}");
            }
            json.append("]}");
            byte[] body = json.toString().getBytes(StandardCharsets.UTF_8);
            exchange.sendResponseHeaders(200, body.length);
            exchange.getResponseBody().write(body);
            exchange.close();
        });
        server.start();
        try {
            NvidiaEmbeddingModel model = new NvidiaEmbeddingModel(
                    "test-key",
                    "http://127.0.0.1:" + server.getAddress().getPort(),
                    "nvidia/nemotron-3.5-embed-1b",
                    Duration.ofSeconds(5),
                    0,
                    new ObjectMapper()
            );

            List<Embedding> embeddings = model.embedPassages(List.of("one", "two"));

            assertEquals(1, calls.get());
            assertEquals(2, embeddings.size());
        } finally {
            server.stop(0);
        }
    }

    @Test
    void skipsOnlyThePassageRejectedByContentSafety() throws Exception {
        HttpServer server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/embeddings", exchange -> {
            String request = new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8);
            int inputs = new ObjectMapper().readTree(request).path("input").size();
            boolean rejected = request.contains("blocked");
            byte[] body = rejected
                    ? "{\"error\":{\"message\":\"input rejected by content safety screening\"}}".getBytes(StandardCharsets.UTF_8)
                    : batchVectors(inputs);
            exchange.sendResponseHeaders(rejected ? 422 : 200, body.length);
            exchange.getResponseBody().write(body);
            exchange.close();
        });
        server.start();
        try {
            NvidiaEmbeddingModel model = model(server.getAddress().getPort(), Duration.ofSeconds(5), 0);
            List<Embedding> embeddings = model.embedPassages(List.of("one", "blocked", "three"));

            assertEquals(3, embeddings.size());
            assertEquals(0.25f, embeddings.get(0).vector()[0]);
            assertNull(embeddings.get(1));
            assertEquals(0.25f, embeddings.get(2).vector()[0]);
        } finally {
            server.stop(0);
        }
    }

    @Test
    void retriesATimedOutEmbeddingRequest() throws Exception {
        AtomicInteger calls = new AtomicInteger();
        HttpServer server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.setExecutor(Executors.newCachedThreadPool());
        server.createContext("/embeddings", exchange -> {
            if (calls.incrementAndGet() == 1) {
                try {
                    Thread.sleep(800);
                } catch (InterruptedException interrupted) {
                    Thread.currentThread().interrupt();
                }
            }
            byte[] body = batchVectors(1);
            exchange.sendResponseHeaders(200, body.length);
            exchange.getResponseBody().write(body);
            exchange.close();
        });
        server.start();
        try {
            NvidiaEmbeddingModel model = model(server.getAddress().getPort(), Duration.ofMillis(200), 1);
            List<Embedding> embeddings = model.embedPassages(List.of("one"));

            assertEquals(1, embeddings.size());
            assertTrue(calls.get() >= 2);
        } finally {
            server.stop(0);
        }
    }

    private static NvidiaEmbeddingModel model(int port, Duration timeout, int maxRetries) {
        return new NvidiaEmbeddingModel(
                "test-key",
                "http://127.0.0.1:" + port,
                "nvidia/nemotron-3.5-embed-1b",
                timeout,
                maxRetries,
                new ObjectMapper()
        );
    }

    private static byte[] batchVectors(int inputs) {
        StringBuilder json = new StringBuilder("{\"data\":[");
        for (int i = 0; i < inputs; i++) {
            if (i > 0) {
                json.append(',');
            }
            json.append("{\"embedding\":[0.25,0.5]}");
        }
        json.append("]}");
        return json.toString().getBytes(StandardCharsets.UTF_8);
    }
}
