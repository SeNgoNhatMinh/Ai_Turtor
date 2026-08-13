package com.ragapi.service;

import org.junit.jupiter.api.Test;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import java.util.concurrent.Callable;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.atomic.AtomicInteger;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class LlmProviderChainTest {

    private static final Clock FIXED_CLOCK = Clock.fixed(Instant.parse("2026-07-28T00:00:00Z"), ZoneOffset.UTC);

    @Test
    void fallsBackOnQuotaAndPlacesProviderInCooldown() throws Exception {
        AtomicInteger primaryCalls = new AtomicInteger();
        AtomicInteger fallbackCalls = new AtomicInteger();
        LlmProviderChain chain = chain(
                provider("groq", prompt -> {
                    primaryCalls.incrementAndGet();
                    throw new RuntimeException("HTTP 429 rate limit exceeded");
                }),
                provider("primary", prompt -> {
                    fallbackCalls.incrementAndGet();
                    return "ok";
                })
        );

        LlmProviderChain.Result first = chain.generate("question");
        LlmProviderChain.Result second = chain.generate("question 2");

        assertEquals("primary", first.provider());
        assertEquals("primary", second.provider());
        assertEquals(1, primaryCalls.get());
        assertEquals(2, fallbackCalls.get());
        assertTrue(chain.isCoolingDown("groq"));
    }

    @Test
    void fallsBackOnAuthenticationFailureAndDisablesBrokenProvider() throws Exception {
        AtomicInteger fallbackCalls = new AtomicInteger();
        LlmProviderChain chain = chain(
                provider("groq", prompt -> { throw new RuntimeException("HTTP 401 invalid API key"); }),
                provider("primary", prompt -> {
                    fallbackCalls.incrementAndGet();
                    return "must not run";
                })
        );

        assertEquals("primary", chain.generate("question").provider());
        assertEquals(1, fallbackCalls.get());
        assertTrue(chain.isCoolingDown("groq"));
    }

    @Test
    void doesNotFallbackOnBadRequest() {
        AtomicInteger fallbackCalls = new AtomicInteger();
        LlmProviderChain chain = chain(
                provider("groq", prompt -> { throw new RuntimeException("HTTP 400 bad request"); }),
                provider("primary", prompt -> {
                    fallbackCalls.incrementAndGet();
                    return "must not run";
                })
        );

        assertThrows(RuntimeException.class, () -> chain.generate("question"));
        assertEquals(0, fallbackCalls.get());
    }

    @Test
    void fallsBackOnTimeoutAndServerErrors() throws Exception {
        LlmProviderChain chain = chain(
                provider("groq", prompt -> { throw new RuntimeException("request timed out"); }),
                provider("primary", prompt -> { throw new RuntimeException("HTTP 503 unavailable"); }),
                provider("openrouter", prompt -> "answer")
        );

        assertEquals("openrouter", chain.generate("question").provider());
    }

    @Test
    void fallsBackToLocalWhenHostedProvidersAreOutOfQuota() throws Exception {
        LlmProviderChain chain = chain(
                provider("groq", prompt -> { throw new RuntimeException("HTTP 429 tokens per day quota exceeded"); }),
                provider("nvidia", prompt -> { throw new RuntimeException("HTTP 429 rate limit exceeded"); }),
                provider("openrouter", prompt -> { throw new RuntimeException("HTTP 402 insufficient credits"); }),
                provider("ollama", prompt -> "local-answer")
        );

        LlmProviderChain.Result result = chain.generate("question");

        assertEquals("ollama", result.provider());
        assertEquals("local-answer", result.text());
        assertEquals(1L, chain.snapshot().stream()
                .filter(row -> "groq".equals(row.get("provider")))
                .findFirst().orElseThrow().get("quotaFailures"));
    }

    @Test
    void rejectsEmptyProviderConfiguration() {
        assertThrows(IllegalArgumentException.class,
                () -> new LlmProviderChain(List.of(), Duration.ofSeconds(60), FIXED_CLOCK));
    }

    @Test
    void handlesThirtyConcurrentStudentRequests() throws Exception {
        AtomicInteger calls = new AtomicInteger();
        LlmProviderChain chain = chain(provider("groq", prompt -> {
            calls.incrementAndGet();
            return "answer:" + prompt;
        }));
        ExecutorService executor = Executors.newFixedThreadPool(10);
        try {
            List<Callable<LlmProviderChain.Result>> requests = java.util.stream.IntStream.range(0, 30)
                    .mapToObj(index -> (Callable<LlmProviderChain.Result>) () -> chain.generate("student-" + index))
                    .toList();
            List<Future<LlmProviderChain.Result>> futures = executor.invokeAll(requests);

            assertEquals(30, calls.get());
            for (int index = 0; index < futures.size(); index++) {
                assertEquals("answer:student-" + index, futures.get(index).get().text());
                assertEquals("groq", futures.get(index).get().provider());
            }
        } finally {
            executor.shutdownNow();
        }
    }

    private LlmProviderChain chain(LlmProviderChain.Provider... providers) {
        return new LlmProviderChain(List.of(providers), Duration.ofSeconds(60), FIXED_CLOCK);
    }

    private LlmProviderChain.Provider provider(String name, LlmProviderChain.Generator generator) {
        return new LlmProviderChain.Provider(name, name + "-model", generator);
    }
}
