package com.ragapi.config;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

@Slf4j
@Component
@RequiredArgsConstructor
public class LiveVoiceWebSocketHandler extends TextWebSocketHandler {

    private final ObjectMapper objectMapper;
    private final Set<WebSocketSession> sessions = ConcurrentHashMap.newKeySet();

    @Override
    public void afterConnectionEstablished(WebSocketSession session) throws Exception {
        sessions.add(session);
        String lessonId = attr(session, "lessonId");
        send(session, Map.of(
                "type", "CONNECTED",
                "lessonId", lessonId,
                "userId", attr(session, "userId"),
                "peers", peersInRoom(lessonId, attr(session, "userId"))
        ));
        broadcast(lessonId, attr(session, "userId"), Map.of(
                "type", "PEER_JOINED",
                "peer", peerPayload(session)
        ));
    }

    @Override
    protected void handleTextMessage(WebSocketSession session, TextMessage message) throws Exception {
        try {
            JsonNode payload = objectMapper.readTree(message.getPayload());
            String type = payload.path("type").asText("");
            if ("PING".equalsIgnoreCase(type)) {
                send(session, Map.of("type", "PONG"));
                return;
            }
            String lessonId = attr(session, "lessonId");
            String fromUserId = attr(session, "userId");
            if ("MUTE".equalsIgnoreCase(type)) {
                session.getAttributes().put("muted", payload.path("muted").asBoolean(true));
                broadcast(lessonId, fromUserId, Map.of(
                        "type", "PEER_MUTED",
                        "userId", fromUserId,
                        "muted", payload.path("muted").asBoolean(true)
                ));
                return;
            }
            String toUserId = payload.path("toUserId").asText("");
            if (toUserId.isBlank()) {
                throw new IllegalArgumentException("toUserId is required");
            }
            Map<String, Object> relay = new LinkedHashMap<>();
            relay.put("type", type.toUpperCase());
            relay.put("fromUserId", fromUserId);
            if (payload.has("sdp")) {
                relay.put("sdp", payload.get("sdp").asText(""));
            }
            if (payload.has("candidate")) {
                relay.put("candidate", payload.get("candidate"));
            }
            sendToUser(lessonId, toUserId, relay);
        } catch (Exception e) {
            log.warn("Live voice message rejected: {}", e.getMessage());
            send(session, Map.of("type", "ERROR", "message", e.getMessage() == null ? "Voice error" : e.getMessage()));
        }
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) {
        leave(session);
    }

    @Override
    public void handleTransportError(WebSocketSession session, Throwable exception) {
        leave(session);
    }

    private void leave(WebSocketSession session) {
        sessions.remove(session);
        broadcast(attr(session, "lessonId"), attr(session, "userId"), Map.of(
                "type", "PEER_LEFT",
                "userId", attr(session, "userId")
        ));
    }

    private List<Map<String, Object>> peersInRoom(String lessonId, String exceptUserId) {
        List<Map<String, Object>> peers = new ArrayList<>();
        for (WebSocketSession session : sessions) {
            if (!session.isOpen() || !lessonId.equals(attr(session, "lessonId"))) {
                continue;
            }
            if (exceptUserId.equals(attr(session, "userId"))) {
                continue;
            }
            peers.add(peerPayload(session));
        }
        return peers;
    }

    private Map<String, Object> peerPayload(WebSocketSession session) {
        Map<String, Object> peer = new LinkedHashMap<>();
        peer.put("userId", attr(session, "userId"));
        peer.put("displayName", attr(session, "displayName"));
        peer.put("role", attr(session, "role"));
        peer.put("muted", session.getAttributes().getOrDefault("muted", true));
        return peer;
    }

    private void broadcast(String lessonId, String exceptUserId, Map<String, ?> payload) {
        if (lessonId == null || lessonId.isBlank()) {
            return;
        }
        for (WebSocketSession session : sessions) {
            if (!session.isOpen() || !lessonId.equals(attr(session, "lessonId"))) {
                continue;
            }
            if (exceptUserId != null && exceptUserId.equals(attr(session, "userId"))) {
                continue;
            }
            send(session, payload);
        }
    }

    private void sendToUser(String lessonId, String userId, Map<String, ?> payload) {
        for (WebSocketSession session : sessions) {
            if (session.isOpen()
                    && lessonId.equals(attr(session, "lessonId"))
                    && userId.equals(attr(session, "userId"))) {
                send(session, payload);
            }
        }
    }

    private void send(WebSocketSession session, Object payload) {
        try {
            synchronized (session) {
                if (session.isOpen()) {
                    session.sendMessage(new TextMessage(objectMapper.writeValueAsString(payload)));
                }
            }
        } catch (Exception e) {
            log.warn("Cannot send live-voice event to {}: {}", session.getId(), e.getMessage());
            sessions.remove(session);
        }
    }

    private String attr(WebSocketSession session, String name) {
        return String.valueOf(session.getAttributes().get(name));
    }
}
