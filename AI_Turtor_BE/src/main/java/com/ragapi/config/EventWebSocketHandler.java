package com.ragapi.config;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.ragapi.service.RealtimeEventService;
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

    @Override
    public void afterConnectionEstablished(WebSocketSession session) {
        events.register(session);
        events.send(session, events.connectedEvent(session));
    }

    @Override
    protected void handleTextMessage(WebSocketSession session, TextMessage message) throws Exception {
        JsonNode payload = objectMapper.readTree(message.getPayload());
        if ("PING".equalsIgnoreCase(payload.path("type").asText())) {
            events.send(session, Map.of("type", "PONG"));
        } else {
            events.send(session, Map.of("type", "ERROR", "message", "Only PING is supported on /ws/events"));
        }
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) { events.unregister(session); }

    @Override
    public void handleTransportError(WebSocketSession session, Throwable exception) { events.unregister(session); }
}
