package com.ragapi.service.security;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.stereotype.Service;

import java.util.ArrayDeque;
import java.util.Deque;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * In-memory sliding-window counters (one backend instance). Used to stop password
 * guessing on /api/users/login and floods on the public harness log endpoints.
 * Counts are lost on restart, which is acceptable for these limits.
 */
@Service
public class RateLimiter {

    private static final int MAX_KEYS = 50_000;

    private final Map<String, Deque<Long>> events = new ConcurrentHashMap<>();

    /** Records an event for {@code key}; false when more than {@code limit} happened within {@code windowMs}. */
    public boolean tryAcquire(String key, int limit, long windowMs) {
        long now = System.currentTimeMillis();
        Deque<Long> times = window(key, now, windowMs);
        synchronized (times) {
            if (times.size() >= limit) {
                return false;
            }
            times.addLast(now);
            return true;
        }
    }

    /** Number of events for {@code key} within {@code windowMs}, without recording one. */
    public int count(String key, long windowMs) {
        Deque<Long> times = window(key, System.currentTimeMillis(), windowMs);
        synchronized (times) {
            return times.size();
        }
    }

    /** Records an event without enforcing a limit (e.g. a failed login). */
    public void record(String key, long windowMs) {
        long now = System.currentTimeMillis();
        Deque<Long> times = window(key, now, windowMs);
        synchronized (times) {
            times.addLast(now);
        }
    }

    /** Seconds until the oldest event of {@code key} leaves the window (at least 1). */
    public long retryAfterSeconds(String key, long windowMs) {
        Deque<Long> times = events.get(key);
        if (times == null) return 1;
        synchronized (times) {
            Long oldest = times.peekFirst();
            if (oldest == null) return 1;
            return Math.max(1, (oldest + windowMs - System.currentTimeMillis() + 999) / 1000);
        }
    }

    public void reset(String key) {
        events.remove(key);
    }

    /**
     * Client address. Railway's edge and the frontend's Caddy proxy add
     * X-Forwarded-For; the first entry is the original client. It can be forged,
     * so per-IP limits are only a second layer behind per-account limits.
     */
    public static String clientIp(HttpServletRequest request) {
        String forwarded = request.getHeader("X-Forwarded-For");
        if (forwarded != null && !forwarded.isBlank()) {
            return forwarded.split(",")[0].trim();
        }
        return request.getRemoteAddr();
    }

    private Deque<Long> window(String key, long now, long windowMs) {
        if (events.size() > MAX_KEYS) {
            prune(now, windowMs);
        }
        Deque<Long> times = events.computeIfAbsent(key, k -> new ArrayDeque<>());
        synchronized (times) {
            while (!times.isEmpty() && times.peekFirst() <= now - windowMs) {
                times.pollFirst();
            }
        }
        return times;
    }

    private void prune(long now, long windowMs) {
        events.entrySet().removeIf(entry -> {
            Deque<Long> times = entry.getValue();
            synchronized (times) {
                Long newest = times.peekLast();
                return newest == null || newest <= now - windowMs;
            }
        });
    }
}
