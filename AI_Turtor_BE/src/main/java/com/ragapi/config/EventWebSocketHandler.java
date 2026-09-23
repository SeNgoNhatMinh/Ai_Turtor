package com.ragapi.config;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.ragapi.service.RealtimeEventService;
import com.ragapi.service.presence.TeacherPresenceService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;

import java.util.Map;

@Component
@RequiredArgsConstructor
public class EventWebSocketHandler extends TextWebSocketHandler {
    private final RealtimeEventService events;
    private final ObjectMapper objectMapper;
    private final TeacherPresenceService teacherPresenceService;

    @Override
    public void afterConnectionEstablished(WebSocketSession session) {
        events.register(session);
        publishPresenceChange(teacherPresenceService.connect(
                attribute(session, "userId"),
                attribute(session, "role"),
                session.getId()
        ));
        events.send(session, events.connectedEvent(session));
    }

    @Override
    protected void handleTextMessage(WebSocketSession session, TextMessage message) throws Exception {
        JsonNode payload = objectMapper.readTree(message.getPayload());
        if ("PING".equalsIgnoreCase(payload.path("type").asText())) {
            publishPresenceChange(teacherPresenceService.heartbeat(
                    attribute(session, "userId"),
                    attribute(session, "role"),
                    session.getId()
            ));
            events.send(session, Map.of("type", "PONG", "presenceRefreshed", true));
        } else {
            events.send(session, Map.of("type", "ERROR", "message", "Only PING is supported on /ws/events"));
        }
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) {
        disconnect(session);
    }

    @Override
    public void handleTransportError(WebSocketSession session, Throwable exception) {
        disconnect(session);
    }

    private void disconnect(WebSocketSession session) {
        events.unregister(session);
        publishPresenceChange(teacherPresenceService.disconnect(
                attribute(session, "userId"),
                attribute(session, "role"),
                session.getId()
        ));
    }

    private void publishPresenceChange(TeacherPresenceService.PresenceTransition transition) {
        if (transition.changed()) {
            events.publishTeacherPresence(transition.teacherId(), transition.online());
        }
    }

    private String attribute(WebSocketSession session, String name) {
        if (session == null || session.getAttributes() == null) {
            return "";
        }
        Object value = session.getAttributes().get(name);
        return value == null ? "" : String.valueOf(value);
    }
}
