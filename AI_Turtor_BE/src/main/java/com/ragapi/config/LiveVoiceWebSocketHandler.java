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
        boolean teacher = isTeacher(session);
        session.getAttributes().putIfAbsent("muted", true);
        session.getAttributes().putIfAbsent("handRaised", false);
        session.getAttributes().putIfAbsent("canSpeak", teacher);
        String lessonId = attr(session, "lessonId");
        send(session, Map.of(
                "type", "CONNECTED",
                "lessonId", lessonId,
                "userId", attr(session, "userId"),
                "canSpeak", teacher,
                "peers", peersInRoom(lessonId, attr(session, "userId")),
                "participants", everyone(lessonId)
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
                boolean muted = payload.path("muted").asBoolean(true);
                if (!muted && !canSpeak(session)) {
                    throw new IllegalArgumentException("Giảng viên chưa cho phép bạn nói.");
                }
                session.getAttributes().put("muted", muted);
                if (muted) {
                    session.getAttributes().put("handRaised", false);
                }
                broadcast(lessonId, null, Map.of("type", "PEER_UPDATED", "peer", peerPayload(session)));
                return;
            }
            if ("RAISE_HAND".equalsIgnoreCase(type) || "LOWER_HAND".equalsIgnoreCase(type)) {
                if (isTeacher(session)) {
                    return;
                }
                boolean raised = "RAISE_HAND".equalsIgnoreCase(type);
                session.getAttributes().put("handRaised", raised);
                broadcast(lessonId, null, Map.of("type", "PEER_UPDATED", "peer", peerPayload(session)));
                return;
            }
            if ("MUTE_ALL".equalsIgnoreCase(type)) {
                requireTeacher(session);
                muteAllStudents(lessonId);
                broadcast(lessonId, null, Map.of(
                        "type", "MUTE_ALL",
                        "participants", everyone(lessonId)
                ));
                return;
            }
            if ("ALLOW_SPEAK".equalsIgnoreCase(type) || "MUTE_USER".equalsIgnoreCase(type)) {
                requireTeacher(session);
                String toUserId = payload.path("toUserId").asText("");
                WebSocketSession target = findInRoom(lessonId, toUserId);
                if (target == null) {
                    throw new IllegalArgumentException("Không thấy sinh viên này trong phòng.");
                }
                boolean allow = "ALLOW_SPEAK".equalsIgnoreCase(type);
                target.getAttributes().put("canSpeak", allow);
                target.getAttributes().put("handRaised", false);
                if (!allow) {
                    target.getAttributes().put("muted", true);
                    send(target, Map.of("type", "FORCE_MUTE"));
                } else {
                    send(target, Map.of("type", "SPEAK_ALLOWED"));
                }
                broadcast(lessonId, null, Map.of("type", "PEER_UPDATED", "peer", peerPayload(target)));
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
            if (payload.hasNonNull("candidate")) {
                relay.put("candidate", objectMapper.convertValue(payload.get("candidate"), Object.class));
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

    private void muteAllStudents(String lessonId) {
        for (WebSocketSession session : sessions) {
            if (!session.isOpen() || !lessonId.equals(attr(session, "lessonId")) || isTeacher(session)) {
                continue;
            }
            session.getAttributes().put("muted", true);
            session.getAttributes().put("canSpeak", false);
            session.getAttributes().put("handRaised", false);
            send(session, Map.of("type", "FORCE_MUTE"));
        }
    }

    private List<Map<String, Object>> peersInRoom(String lessonId, String exceptUserId) {
        List<Map<String, Object>> peers = new ArrayList<>();
        for (WebSocketSession session : sessionsInRoom(lessonId)) {
            if (exceptUserId.equals(attr(session, "userId"))) {
                continue;
            }
            peers.add(peerPayload(session));
        }
        return peers;
    }

    private List<Map<String, Object>> everyone(String lessonId) {
        List<Map<String, Object>> peers = new ArrayList<>();
        for (WebSocketSession session : sessionsInRoom(lessonId)) {
            peers.add(peerPayload(session));
        }
        return peers;
    }

    private List<WebSocketSession> sessionsInRoom(String lessonId) {
        List<WebSocketSession> room = new ArrayList<>();
        for (WebSocketSession session : sessions) {
            if (session.isOpen() && lessonId.equals(attr(session, "lessonId"))) {
                room.add(session);
            }
        }
        return room;
    }

    private WebSocketSession findInRoom(String lessonId, String userId) {
        if (userId == null || userId.isBlank()) {
            return null;
        }
        for (WebSocketSession session : sessionsInRoom(lessonId)) {
            if (userId.equals(attr(session, "userId"))) {
                return session;
            }
        }
        return null;
    }

    private Map<String, Object> peerPayload(WebSocketSession session) {
        Map<String, Object> peer = new LinkedHashMap<>();
        peer.put("userId", attr(session, "userId"));
        peer.put("displayName", attr(session, "displayName"));
        peer.put("role", attr(session, "role"));
        peer.put("muted", boolAttr(session, "muted", true));
        peer.put("handRaised", boolAttr(session, "handRaised", false));
        peer.put("canSpeak", boolAttr(session, "canSpeak", isTeacher(session)));
        return peer;
    }

    private void broadcast(String lessonId, String exceptUserId, Map<String, ?> payload) {
        if (lessonId == null || lessonId.isBlank()) {
            return;
        }
        for (WebSocketSession session : sessionsInRoom(lessonId)) {
            if (exceptUserId != null && exceptUserId.equals(attr(session, "userId"))) {
                continue;
            }
            send(session, payload);
        }
    }

    private void sendToUser(String lessonId, String userId, Map<String, ?> payload) {
        WebSocketSession session = findInRoom(lessonId, userId);
        if (session != null) {
            send(session, payload);
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

    private void requireTeacher(WebSocketSession session) {
        if (!isTeacher(session)) {
            throw new IllegalArgumentException("Only the teacher can moderate the class mic");
        }
    }

    private boolean canSpeak(WebSocketSession session) {
        return isTeacher(session) || boolAttr(session, "canSpeak", false);
    }

    private boolean isTeacher(WebSocketSession session) {
        String role = attr(session, "role").toUpperCase();
        return "TEACHER".equals(role) || "ADMIN".equals(role) || "SENIOR_MENTOR".equals(role);
    }

    private boolean boolAttr(WebSocketSession session, String name, boolean fallback) {
        Object value = session.getAttributes().get(name);
        if (value instanceof Boolean bool) {
            return bool;
        }
        return fallback;
    }

    private String attr(WebSocketSession session, String name) {
        return String.valueOf(session.getAttributes().get(name));
    }
}
