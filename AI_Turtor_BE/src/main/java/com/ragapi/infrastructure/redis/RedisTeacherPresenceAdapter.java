package com.ragapi.infrastructure.redis;

import com.ragapi.service.presence.TeacherPresenceGateway;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Component;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Duration;
import java.util.HexFormat;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/** Redis sorted-set presence leases with an in-process fallback during Redis outages. */
@Slf4j
@Component
public class RedisTeacherPresenceAdapter implements TeacherPresenceGateway {

    private final ObjectProvider<StringRedisTemplate> redisTemplateProvider;
    private final Map<String, Map<String, Long>> localLeases = new ConcurrentHashMap<>();

    @Value("${app.redis-cache.enabled:true}")
    private boolean redisEnabled;

    @Value("${app.redis-cache.key-prefix:ai-tutor}")
    private String keyPrefix;

    public RedisTeacherPresenceAdapter(ObjectProvider<StringRedisTemplate> redisTemplateProvider) {
        this.redisTemplateProvider = redisTemplateProvider;
    }

    @Override
    public boolean refresh(String teacherId, String connectionId, Duration ttl) {
        long now = System.currentTimeMillis();
        long expiresAt = now + ttl.toMillis();
        StringRedisTemplate redis = redis();
        if (redis != null) {
            try {
                String key = key(teacherId);
                redis.opsForZSet().removeRangeByScore(key, 0, now);
                Long activeBefore = redis.opsForZSet().zCard(key);
                redis.opsForZSet().add(key, connectionId, expiresAt);
                redis.expire(key, ttl.plus(ttl));
                return activeBefore == null || activeBefore == 0;
            } catch (Exception exception) {
                log.warn("Redis teacher presence refresh failed; using local leases: {}", exception.getMessage());
            }
        }
        return refreshLocal(teacherId, connectionId, expiresAt, now);
    }

    @Override
    public boolean remove(String teacherId, String connectionId) {
        long now = System.currentTimeMillis();
        StringRedisTemplate redis = redis();
        if (redis != null) {
            try {
                String key = key(teacherId);
                Long removed = redis.opsForZSet().remove(key, connectionId);
                redis.opsForZSet().removeRangeByScore(key, 0, now);
                Long remaining = redis.opsForZSet().zCard(key);
                if (remaining == null || remaining == 0) {
                    redis.delete(key);
                    return removed != null && removed > 0;
                }
                return false;
            } catch (Exception exception) {
                log.warn("Redis teacher presence removal failed; using local leases: {}", exception.getMessage());
            }
        }
        return removeLocal(teacherId, connectionId, now);
    }

    @Override
    public boolean isOnline(String teacherId) {
        long now = System.currentTimeMillis();
        StringRedisTemplate redis = redis();
        if (redis != null) {
            try {
                String key = key(teacherId);
                redis.opsForZSet().removeRangeByScore(key, 0, now);
                Long active = redis.opsForZSet().zCard(key);
                return active != null && active > 0;
            } catch (Exception exception) {
                log.warn("Redis teacher presence query failed; using local leases: {}", exception.getMessage());
            }
        }
        return isOnlineLocal(teacherId, now);
    }

    private boolean refreshLocal(String teacherId, String connectionId, long expiresAt, long now) {
        Map<String, Long> leases = localLeases.computeIfAbsent(teacherId, ignored -> new ConcurrentHashMap<>());
        leases.entrySet().removeIf(entry -> entry.getValue() <= now);
        boolean becameOnline = leases.isEmpty();
        leases.put(connectionId, expiresAt);
        return becameOnline;
    }

    private boolean removeLocal(String teacherId, String connectionId, long now) {
        Map<String, Long> leases = localLeases.get(teacherId);
        if (leases == null) {
            return false;
        }
        boolean removed = leases.remove(connectionId) != null;
        leases.entrySet().removeIf(entry -> entry.getValue() <= now);
        if (leases.isEmpty()) {
            localLeases.remove(teacherId, leases);
            return removed;
        }
        return false;
    }

    private boolean isOnlineLocal(String teacherId, long now) {
        Map<String, Long> leases = localLeases.get(teacherId);
        if (leases == null) {
            return false;
        }
        leases.entrySet().removeIf(entry -> entry.getValue() <= now);
        if (leases.isEmpty()) {
            localLeases.remove(teacherId, leases);
            return false;
        }
        return true;
    }

    private StringRedisTemplate redis() {
        return redisEnabled ? redisTemplateProvider.getIfAvailable() : null;
    }

    private String key(String teacherId) {
        String prefix = keyPrefix == null || keyPrefix.isBlank() ? "ai-tutor" : keyPrefix.trim();
        return prefix + ":presence:teacher:" + digest(teacherId);
    }

    private String digest(String value) {
        try {
            byte[] hash = MessageDigest.getInstance("SHA-256")
                    .digest(value.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(hash);
        } catch (Exception exception) {
            return Integer.toHexString(value.hashCode());
        }
    }
}
