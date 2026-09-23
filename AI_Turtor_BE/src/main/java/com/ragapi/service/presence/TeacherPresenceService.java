package com.ragapi.service.presence;

import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.time.Duration;

/** Maintains expiring presence leases for authenticated teacher WebSockets. */
@Service
@RequiredArgsConstructor
public class TeacherPresenceService {

    private final TeacherPresenceGateway gateway;

    @Value("${app.teacher-presence.ttl-seconds:45}")
    private long ttlSeconds;

    public PresenceTransition connect(String userId, String role, String connectionId) {
        return refresh(userId, role, connectionId);
    }

    public PresenceTransition heartbeat(String userId, String role, String connectionId) {
        return refresh(userId, role, connectionId);
    }

    public PresenceTransition disconnect(String userId, String role, String connectionId) {
        if (!isTeacherRole(role) || invalid(userId) || invalid(connectionId)) {
            return PresenceTransition.unchanged(userId, false);
        }
        boolean becameOffline = gateway.remove(userId.trim(), connectionId);
        return new PresenceTransition(userId.trim(), false, becameOffline);
    }

    private PresenceTransition refresh(String userId, String role, String connectionId) {
        if (!isTeacherRole(role) || invalid(userId) || invalid(connectionId)) {
            return PresenceTransition.unchanged(userId, false);
        }
        boolean becameOnline = gateway.refresh(
                userId.trim(), connectionId, Duration.ofSeconds(Math.max(10, ttlSeconds)));
        return new PresenceTransition(userId.trim(), true, becameOnline);
    }

    private boolean isTeacherRole(String role) {
        return "TEACHER".equalsIgnoreCase(role)
                || "MENTOR".equalsIgnoreCase(role)
                || "SENIOR_MENTOR".equalsIgnoreCase(role);
    }

    private boolean invalid(String value) {
        return value == null || value.isBlank();
    }

    public record PresenceTransition(String teacherId, boolean online, boolean changed) {
        static PresenceTransition unchanged(String teacherId, boolean online) {
            return new PresenceTransition(teacherId, online, false);
        }
    }
}
