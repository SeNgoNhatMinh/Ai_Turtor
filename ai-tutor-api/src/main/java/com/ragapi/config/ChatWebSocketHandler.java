package com.ragapi.config;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.ragapi.dto.ChatMessageRequest;
import com.ragapi.service.ChatService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;

import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

@Slf4j
@Component
@RequiredArgsConstructor
public class ChatWebSocketHandler extends TextWebSocketHandler {

    private final ChatService chatService;
    private final ObjectMapper objectMapper;
    private final Set<WebSocketSession> sessions = ConcurrentHashMap.newKeySet();

    @Override
    public void afterConnectionEstablished(WebSocketSession session) throws Exception {
        sessions.add(session);
        session.sendMessage(json(Map.of(
                "type", "CONNECTED",
                "chatRoomId", attr(session, "chatRoomId"),
                "userId", attr(session, "userId"))));
    }

    @Override
    protected void handleTextMessage(WebSocketSession session, TextMessage message) throws Exception {
        try {
            JsonNode payload = objectMapper.readTree(message.getPayload());
            String type = payload.path("type").asText("SEND_MESSAGE");
            if ("PING".equalsIgnoreCase(type)) {
                session.sendMessage(json(Map.of("type", "PONG")));
                return;
            }
            if (!"SEND_MESSAGE".equalsIgnoreCase(type)) {
                throw new IllegalArgumentException("Unsupported WebSocket message type: " + type);
            }

            String role = attr(session, "role");
            ChatMessageRequest request = ChatMessageRequest.builder()
                    .chatRoomId(attr(session, "chatRoomId"))
                    .senderId(attr(session, "userId"))
                    .senderName(payload.path("senderName").asText(""))
                    .senderRole(isTeacher(role) ? "MENTOR" : "STUDENT")
                    .content(payload.path("content").asText(null))
                    .messageType(payload.path("messageType").asText("TEXT"))
                    .attachmentUrl(textOrNull(payload, "attachmentUrl"))
                    .attachmentName(textOrNull(payload, "attachmentName"))
                    .build();
            var saved = chatService.sendMessage(request, attr(session, "userId"), role);
            broadcast(attr(session, "chatRoomId"), Map.of("type", "NEW_MESSAGE", "message", saved));
        } catch (Exception e) {
            log.warn("WebSocket chat message rejected: {}", e.getMessage());
            session.sendMessage(json(Map.of("type", "ERROR", "message", e.getMessage() == null ? "Chat error" : e.getMessage())));
        }
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) {
        sessions.remove(session);
    }

    @Override
    public void handleTransportError(WebSocketSession session, Throwable exception) {
        sessions.remove(session);
    }

    private void broadcast(String roomId, Object payload) {
        TextMessage message;
        try {
            message = json(payload);
        } catch (Exception e) {
            throw new IllegalStateException("Cannot serialize chat message", e);
        }
        sessions.stream()
                .filter(WebSocketSession::isOpen)
                .filter(session -> roomId.equals(attr(session, "chatRoomId")))
                .forEach(session -> {
                    try {
                        synchronized (session) {
                            session.sendMessage(message);
                        }
                    } catch (Exception e) {
                        log.warn("Cannot broadcast chat message to session {}", session.getId());
                    }
                });
    }

    private TextMessage json(Object value) throws Exception {
        return new TextMessage(objectMapper.writeValueAsString(value));
    }

    private String attr(WebSocketSession session, String name) {
        return String.valueOf(session.getAttributes().get(name));
    }

    private String textOrNull(JsonNode node, String field) {
        String value = node.path(field).asText(null);
        return value == null || value.isBlank() ? null : value;
    }

    private boolean isTeacher(String role) {
        return "TEACHER".equalsIgnoreCase(role)
                || "SENIOR_MENTOR".equalsIgnoreCase(role)
                || "ADMIN".equalsIgnoreCase(role);
    }
}
