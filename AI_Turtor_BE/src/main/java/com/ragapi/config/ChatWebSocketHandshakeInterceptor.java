package com.ragapi.config;

import com.ragapi.service.ChatService;
import com.ragapi.service.JwtService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.server.ServerHttpRequest;
import org.springframework.http.server.ServerHttpResponse;
import org.springframework.stereotype.Component;
import org.springframework.util.MultiValueMap;
import org.springframework.web.socket.WebSocketHandler;
import org.springframework.web.socket.server.HandshakeInterceptor;
import org.springframework.web.util.UriComponentsBuilder;

import java.util.Map;

@Component
@RequiredArgsConstructor
public class ChatWebSocketHandshakeInterceptor implements HandshakeInterceptor {

    private final JwtService jwtService;
    private final ChatService chatService;

    @Override
    public boolean beforeHandshake(ServerHttpRequest request, ServerHttpResponse response,
                                   WebSocketHandler wsHandler, Map<String, Object> attributes) {
        MultiValueMap<String, String> query = UriComponentsBuilder.fromUri(request.getURI()).build().getQueryParams();
        String token = query.getFirst("token");
        String chatRoomId = query.getFirst("chatRoomId");
        Map<String, Object> claims = jwtService.validateAndParse(token);
        String userId = String.valueOf(claims.get("userId"));
        String role = String.valueOf(claims.getOrDefault("role", "STUDENT")).toUpperCase();
        chatService.requireAccessibleRoom(chatRoomId, userId, role);
        attributes.put("userId", userId);
        attributes.put("role", role);
        attributes.put("chatRoomId", chatRoomId);
        return true;
    }

    @Override
    public void afterHandshake(ServerHttpRequest request, ServerHttpResponse response,
                               WebSocketHandler wsHandler, Exception exception) {
        // No-op.
    }
}
