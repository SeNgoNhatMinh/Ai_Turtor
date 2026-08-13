package com.ragapi.service;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicLong;

final class LlmProviderChain {

    @FunctionalInterface
    interface Generator {
        String generate(String prompt) throws Exception;
    }

    record Provider(String name, String model, Generator generator) {}

    record Result(String text, String provider, String model) {}

    private final List<Provider> providers;
    private final Duration cooldown;
    private final Duration quotaCooldown;
    private final Duration dailyQuotaCooldown;
    private final Clock clock;
    private final Map<String, Instant> unavailableUntil = new ConcurrentHashMap<>();
    private final Map<String, ProviderMetrics> metrics = new ConcurrentHashMap<>();

    LlmProviderChain(List<Provider> providers, Duration cooldown) {
        this(providers, cooldown, Duration.ofMinutes(15), Duration.ofHours(24), Clock.systemUTC());
    }

    LlmProviderChain(List<Provider> providers, Duration cooldown, Clock clock) {
        this(providers, cooldown, Duration.ofMinutes(15), Duration.ofHours(24), clock);
    }

    LlmProviderChain(List<Provider> providers, Duration cooldown, Duration quotaCooldown,
                     Duration dailyQuotaCooldown, Clock clock) {
        if (providers == null || providers.isEmpty()) {
            throw new IllegalArgumentException("At least one LLM provider must be configured");
        }
        this.providers = List.copyOf(providers);
        this.cooldown = cooldown == null || cooldown.isNegative() ? Duration.ZERO : cooldown;
        this.quotaCooldown = quotaCooldown == null || quotaCooldown.isNegative() ? Duration.ZERO : quotaCooldown;
        this.dailyQuotaCooldown = dailyQuotaCooldown == null || dailyQuotaCooldown.isNegative() ? Duration.ZERO : dailyQuotaCooldown;
        this.clock = clock;
        providers.forEach(provider -> metrics.put(provider.name(), new ProviderMetrics(provider.model())));
    }

    Result generate(String prompt) throws Exception {
        Exception lastFailure = null;
        Instant now = clock.instant();
        for (Provider provider : providers) {
            ProviderMetrics providerMetrics = metrics.get(provider.name());
            Instant blockedUntil = unavailableUntil.get(provider.name());
            if (blockedUntil != null && now.isBefore(blockedUntil)) {
                providerMetrics.skipped.incrementAndGet();
                continue;
            }
            providerMetrics.attempts.incrementAndGet();
            try {
                String text = provider.generator().generate(prompt);
                unavailableUntil.remove(provider.name());
                providerMetrics.successes.incrementAndGet();
                providerMetrics.lastSuccessAt = now;
                return new Result(text, provider.name(), provider.model());
            } catch (Exception error) {
                FailureKind failureKind = classifyFailure(error);
                providerMetrics.failures.incrementAndGet();
                providerMetrics.lastFailureAt = now;
                providerMetrics.lastFailureKind = failureKind.name();
                if (failureKind == FailureKind.FATAL_REQUEST) {
                    throw error;
                }
                if (failureKind == FailureKind.QUOTA) providerMetrics.quotaFailures.incrementAndGet();
                if (failureKind == FailureKind.AUTH) providerMetrics.authFailures.incrementAndGet();
                Duration selectedCooldown = cooldownFor(error, failureKind);
                if (!selectedCooldown.isZero()) {
                    unavailableUntil.put(provider.name(), now.plus(selectedCooldown));
                }
                if (lastFailure != null) {
                    error.addSuppressed(lastFailure);
                }
                lastFailure = error;
            }
        }
        if (lastFailure != null) {
            throw lastFailure;
        }
        throw new IllegalStateException("All configured LLM providers are cooling down");
    }

    boolean isCoolingDown(String providerName) {
        Instant blockedUntil = unavailableUntil.get(providerName);
        return blockedUntil != null && clock.instant().isBefore(blockedUntil);
    }

    static boolean isRetryableProviderFailure(Throwable error) {
        return classifyFailure(error) != FailureKind.FATAL_REQUEST;
    }

    private Duration cooldownFor(Throwable error, FailureKind kind) {
        if (kind == FailureKind.AUTH) return dailyQuotaCooldown;
        if (kind != FailureKind.QUOTA) return cooldown;
        String text = summarize(error).toLowerCase(Locale.ROOT);
        if (containsAny(text, "per day", "daily", "requests per day", "tokens per day", "rpd", "tpd", "insufficient credits", "402")) {
            return dailyQuotaCooldown;
        }
        return quotaCooldown;
    }

    private static FailureKind classifyFailure(Throwable error) {
        String text = summarize(error).toLowerCase(Locale.ROOT);
        if (containsAny(text, "401", "invalid api key", "authentication", "unauthorized", "permission denied")) {
            return FailureKind.AUTH;
        }
        if (containsAny(text, "429", "402", "rate limit", "rate-limited", "too many requests", "quota", "insufficient credits")) {
            return FailureKind.QUOTA;
        }
        if (containsAny(text, "400", "bad request", "content policy", "safety")) {
            return FailureKind.FATAL_REQUEST;
        }
        if (containsAny(text, "403", "forbidden", "404", "model not found", "no endpoints found", "no endpoint",
                "invalid model", "unsupported model", "timeout", "timed out", "500", "502", "503", "504",
                "upstream", "overloaded", "unavailable", "connect", "connection", "reset",
                "choices() is null", "choices is null", "nullpointerexception")) {
            return FailureKind.TRANSIENT;
        }
        return FailureKind.FATAL_REQUEST;
    }

    List<Map<String, Object>> snapshot() {
        Instant now = clock.instant();
        return providers.stream().map(provider -> {
            ProviderMetrics value = metrics.get(provider.name());
            Instant blockedUntil = unavailableUntil.get(provider.name());
            Map<String, Object> row = new java.util.LinkedHashMap<>();
            row.put("provider", provider.name());
            row.put("model", provider.model());
            row.put("attempts", value.attempts.get());
            row.put("successes", value.successes.get());
            row.put("failures", value.failures.get());
            row.put("quotaFailures", value.quotaFailures.get());
            row.put("authFailures", value.authFailures.get());
            row.put("skippedDuringCooldown", value.skipped.get());
            row.put("coolingDown", blockedUntil != null && now.isBefore(blockedUntil));
            row.put("cooldownUntil", blockedUntil);
            row.put("lastFailureKind", value.lastFailureKind);
            row.put("lastFailureAt", value.lastFailureAt);
            row.put("lastSuccessAt", value.lastSuccessAt);
            return row;
        }).toList();
    }

    private enum FailureKind { QUOTA, AUTH, TRANSIENT, FATAL_REQUEST }

    private static final class ProviderMetrics {
        private final AtomicLong attempts = new AtomicLong();
        private final AtomicLong successes = new AtomicLong();
        private final AtomicLong failures = new AtomicLong();
        private final AtomicLong quotaFailures = new AtomicLong();
        private final AtomicLong authFailures = new AtomicLong();
        private final AtomicLong skipped = new AtomicLong();
        private volatile String lastFailureKind;
        private volatile Instant lastFailureAt;
        private volatile Instant lastSuccessAt;
        private ProviderMetrics(String ignoredModel) {}
    }

    static String summarize(Throwable error) {
        StringBuilder result = new StringBuilder();
        Throwable current = error;
        int depth = 0;
        while (current != null && depth++ < 5) {
            if (result.length() > 0) {
                result.append(" | cause=");
            }
            result.append(current.getClass().getSimpleName()).append(": ");
            if (current.getMessage() != null) {
                result.append(current.getMessage());
            }
            current = current.getCause();
        }
        return result.toString();
    }

    private static boolean containsAny(String text, String... fragments) {
        for (String fragment : fragments) {
            if (text.contains(fragment)) {
                return true;
            }
        }
        return false;
    }
}
