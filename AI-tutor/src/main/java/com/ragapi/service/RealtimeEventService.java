package com.ragapi.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;

import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

@Slf4j
@Service
@RequiredArgsConstructor
public class RealtimeEventService {
    private final ObjectMapper objectMapper;
    private final Set<WebSocketSession> sessions = ConcurrentHashMap.newKeySet();

    public void register(WebSocketSession session) { sessions.add(session); }
    public void unregister(WebSocketSession session) { sessions.remove(session); }

    public void publishToUser(String userId, String eventType, String entityType,
                              String entityId, String status, Map<String, ?> data) {
        if (userId == null || userId.isBlank()) return;
        Map<String, Object> event = event(eventType, entityType, entityId, status, data);
        sessions.stream()
                .filter(WebSocketSession::isOpen)
                .filter(session -> userId.equals(String.valueOf(session.getAttributes().get("userId"))))
                .forEach(session -> send(session, event));
    }

    public void publishToUsers(Iterable<String> userIds, String eventType, String entityType,
                               String entityId, String status, Map<String, ?> data) {
        if (userIds == null) return;
        for (String userId : userIds) publishToUser(userId, eventType, entityType, entityId, status, data);
    }

    public void publishToRoles(Iterable<String> roles, String eventType, String entityType,
                               String entityId, String status, Map<String, ?> data) {
        if (roles == null) return;
        Set<String> accepted = ConcurrentHashMap.newKeySet();
        for (String role : roles) {
            if (role != null && !role.isBlank()) accepted.add(role.trim().toUpperCase());
        }
        if (accepted.isEmpty()) return;
        Map<String, Object> event = event(eventType, entityType, entityId, status, data);
        sessions.stream()
                .filter(WebSocketSession::isOpen)
                .filter(session -> accepted.contains(String.valueOf(session.getAttributes().get("role")).toUpperCase()))
                .forEach(session -> send(session, event));
    }

    public Map<String, Object> connectedEvent(WebSocketSession session) {
        return event("CONNECTED", "WEBSOCKET", session.getId(), "READY", Map.of(
                "userId", String.valueOf(session.getAttributes().get("userId")),
                "role", String.valueOf(session.getAttributes().get("role"))));
    }

    private Map<String, Object> event(String type, String entityType, String entityId,
                                      String status, Map<String, ?> data) {
        Map<String, Object> event = new LinkedHashMap<>();
        event.put("type", type);
        event.put("entityType", entityType);
        event.put("entityId", entityId);
        event.put("status", status);
        event.put("timestamp", LocalDateTime.now().toString());
        event.put("data", data == null ? Map.of() : data);
        return event;
    }

    public void send(WebSocketSession session, Object value) {
        try {
            synchronized (session) {
                if (session.isOpen()) session.sendMessage(new TextMessage(objectMapper.writeValueAsString(value)));
            }
        } catch (Exception e) {
            log.warn("Cannot send realtime event to session {}: {}", session.getId(), e.getMessage());
            unregister(session);
        }
    }
}
