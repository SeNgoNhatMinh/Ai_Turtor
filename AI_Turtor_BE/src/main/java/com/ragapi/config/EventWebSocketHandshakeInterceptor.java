package com.ragapi.config;

import com.ragapi.service.auth.ActiveSessionService;
import com.ragapi.service.auth.JwtService;
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
public class EventWebSocketHandshakeInterceptor implements HandshakeInterceptor {
    private final JwtService jwtService;
    private final ActiveSessionService activeSessionService;

    @Override
    public boolean beforeHandshake(ServerHttpRequest request, ServerHttpResponse response,
                                   WebSocketHandler wsHandler, Map<String, Object> attributes) {
        MultiValueMap<String, String> query = UriComponentsBuilder.fromUri(request.getURI()).build().getQueryParams();
        Map<String, Object> claims = jwtService.validateAndParse(query.getFirst("token"));
        String userId = String.valueOf(claims.get("userId"));
        if (!activeSessionService.isActive(userId, claims.get("sid") == null ? null : String.valueOf(claims.get("sid")))) {
            return false; // signed in on another device
        }
        attributes.put("userId", userId);
        attributes.put("role", String.valueOf(claims.getOrDefault("role", "STUDENT")).toUpperCase());
        return true;
    }

    @Override
    public void afterHandshake(ServerHttpRequest request, ServerHttpResponse response,
                               WebSocketHandler wsHandler, Exception exception) {
        // No-op.
    }
}
