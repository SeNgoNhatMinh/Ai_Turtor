package com.ragapi.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.connection.RedisConnection;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Duration;
import java.util.HexFormat;
import java.util.Optional;
import java.util.Set;
import java.util.concurrent.atomic.AtomicLong;

/**
 * JSON cache for values that must be shared by every API instance. Redis is an
 * optimization: operations fail open so canonical stores remain available
 * while Redis is restarting.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class SharedRedisCacheService {

    private final ObjectProvider<StringRedisTemplate> redisTemplateProvider;
    private final ObjectMapper objectMapper;
    private final AtomicLong retryAfterEpochMillis = new AtomicLong(0L);

    @Value("${app.redis-cache.enabled:true}")
    private boolean enabled;

    @Value("${app.redis-cache.key-prefix:ai-tutor}")
    private String keyPrefix;

    @Value("${app.redis-cache.failure-cooldown-seconds:5}")
    private long failureCooldownSeconds;

    public <T> Optional<T> get(String namespace, String key, Class<T> type) {
        StringRedisTemplate template = availableTemplate();
        if (template == null) {
            return Optional.empty();
        }
        try {
            String json = template.opsForValue().get(valueKey(namespace, key));
            if (json == null || json.isBlank()) {
                return Optional.empty();
            }
            markHealthy();
            return Optional.of(objectMapper.readValue(json, type));
        } catch (Exception error) {
            markUnavailable(error);
            return Optional.empty();
        }
    }

    public Optional<String> getString(String namespace, String key) {
        StringRedisTemplate template = availableTemplate();
        if (template == null) {
            return Optional.empty();
        }
        try {
            String value = template.opsForValue().get(valueKey(namespace, key));
            markHealthy();
            return Optional.ofNullable(value);
        } catch (Exception error) {
            markUnavailable(error);
            return Optional.empty();
        }
    }

    public void put(String namespace, String key, Object value, Duration ttl) {
        putGrouped(namespace, key, null, value, ttl);
    }

    public void putString(String namespace, String key, String value, Duration ttl) {
        StringRedisTemplate template = availableTemplate();
        if (template == null || value == null || invalidTtl(ttl)) {
            return;
        }
        try {
            template.opsForValue().set(valueKey(namespace, key), value, ttl);
            markHealthy();
        } catch (Exception error) {
            markUnavailable(error);
        }
    }

    public void putGrouped(String namespace, String key, String group, Object value, Duration ttl) {
        StringRedisTemplate template = availableTemplate();
        if (template == null || value == null || invalidTtl(ttl)) {
            return;
        }
        try {
            String redisKey = valueKey(namespace, key);
            template.opsForValue().set(redisKey, objectMapper.writeValueAsString(value), ttl);
            if (group != null && !group.isBlank()) {
                String redisGroupKey = groupKey(namespace, group);
                template.opsForSet().add(redisGroupKey, redisKey);
                template.expire(redisGroupKey, ttl.plusMinutes(5));
            }
            markHealthy();
        } catch (Exception error) {
            markUnavailable(error);
        }
    }

    public void evict(String namespace, String key) {
        StringRedisTemplate template = availableTemplate();
        if (template == null) {
            return;
        }
        try {
            template.delete(valueKey(namespace, key));
            markHealthy();
        } catch (Exception error) {
            markUnavailable(error);
        }
    }

    public void evictGroup(String namespace, String group) {
        StringRedisTemplate template = availableTemplate();
        if (template == null || group == null || group.isBlank()) {
            return;
        }
        try {
            String redisGroupKey = groupKey(namespace, group);
            Set<String> members = template.opsForSet().members(redisGroupKey);
            if (members != null && !members.isEmpty()) {
                template.delete(members);
            }
            template.delete(redisGroupKey);
            markHealthy();
        } catch (Exception error) {
            markUnavailable(error);
        }
    }

    public boolean isEnabled() {
        return enabled && redisTemplateProvider.getIfAvailable() != null;
    }

    public boolean isAvailable() {
        StringRedisTemplate template = availableTemplate();
        if (template == null || template.getConnectionFactory() == null) {
            return false;
        }
        try (RedisConnection connection = template.getConnectionFactory().getConnection()) {
            boolean available = connection.ping() != null;
            if (available) {
                markHealthy();
            }
            return available;
        } catch (Exception error) {
            markUnavailable(error);
            return false;
        }
    }

    private StringRedisTemplate availableTemplate() {
        if (!enabled || System.currentTimeMillis() < retryAfterEpochMillis.get()) {
            return null;
        }
        return redisTemplateProvider.getIfAvailable();
    }

    private boolean invalidTtl(Duration ttl) {
        return ttl == null || ttl.isZero() || ttl.isNegative();
    }

    private String valueKey(String namespace, String key) {
        return prefix() + ":cache:" + safeNamespace(namespace) + ":" + digest(key);
    }

    private String groupKey(String namespace, String group) {
        return prefix() + ":group:" + safeNamespace(namespace) + ":" + digest(group);
    }

    private String prefix() {
        String configured = keyPrefix == null ? "" : keyPrefix.trim();
        return configured.isBlank() ? "ai-tutor" : configured.replaceAll("[^a-zA-Z0-9:_-]", "-");
    }

    private String safeNamespace(String namespace) {
        String value = namespace == null ? "default" : namespace.trim();
        return value.isBlank() ? "default" : value.replaceAll("[^a-zA-Z0-9_-]", "-");
    }

    private String digest(String value) {
        String input = value == null ? "" : value;
        try {
            byte[] hash = MessageDigest.getInstance("SHA-256")
                    .digest(input.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(hash);
        } catch (Exception error) {
            return Integer.toHexString(input.hashCode());
        }
    }

    private void markHealthy() {
        retryAfterEpochMillis.set(0L);
    }

    private void markUnavailable(Exception error) {
        long now = System.currentTimeMillis();
        long cooldownMillis = Duration.ofSeconds(Math.max(1L, failureCooldownSeconds)).toMillis();
        long previous = retryAfterEpochMillis.getAndSet(now + cooldownMillis);
        if (previous <= now) {
            log.warn("Redis cache unavailable; continuing without shared cache: {}", error.getMessage());
        }
    }
}
