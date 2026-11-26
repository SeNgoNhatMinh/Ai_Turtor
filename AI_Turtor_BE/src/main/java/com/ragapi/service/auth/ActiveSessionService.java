package com.ragapi.service.auth;

import com.ragapi.entity.AuthActiveSession;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

/**
 * One device per account. Every sign-in starts a new session id, stored as the
 * account's only valid session and carried in the JWT ("sid") and refresh token;
 * tokens of the previous device stop working.
 *
 * Lookups are cached for a few seconds because every authenticated request checks
 * the session. With one backend instance a sign-in updates the cache directly;
 * another instance would notice within CACHE_TTL_MS.
 */
@Service
public class ActiveSessionService {

    static final long CACHE_TTL_MS = 10_000;

    private final MongoTemplate mongoTemplate;
    private final Map<String, Cached> cache = new ConcurrentHashMap<>();

    public ActiveSessionService(MongoTemplate mongoTemplate) {
        this.mongoTemplate = mongoTemplate;
    }

    /** Replaces the account's session and returns the new session id. */
    public String startNewSession(String userId) {
        requireUserId(userId);
        String sessionId = UUID.randomUUID().toString();
        mongoTemplate.save(AuthActiveSession.builder()
                .userId(userId)
                .sessionId(sessionId)
                .startedAt(Instant.now())
                .build());
        cache.put(userId, new Cached(sessionId, System.currentTimeMillis()));
        return sessionId;
    }

    /** True only for the account's current session. Tokens without a session id are rejected. */
    public boolean isActive(String userId, String sessionId) {
        if (userId == null || userId.isBlank() || sessionId == null || sessionId.isBlank()) {
            return false;
        }
        long now = System.currentTimeMillis();
        Cached cached = cache.get(userId);
        if (cached == null || now - cached.loadedAtMs() > CACHE_TTL_MS) {
            AuthActiveSession stored = mongoTemplate.findById(userId, AuthActiveSession.class);
            cached = new Cached(stored == null ? null : stored.getSessionId(), now);
            cache.put(userId, cached);
        }
        return Objects.equals(cached.sessionId(), sessionId);
    }

    private static void requireUserId(String userId) {
        if (userId == null || userId.isBlank()) {
            throw new IllegalArgumentException("userId is required");
        }
    }

    private record Cached(String sessionId, long loadedAtMs) {}
}
