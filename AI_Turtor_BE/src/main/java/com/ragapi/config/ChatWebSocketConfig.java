package com.ragapi.config;

import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.socket.config.annotation.EnableWebSocket;
import org.springframework.web.socket.config.annotation.WebSocketConfigurer;
import org.springframework.web.socket.config.annotation.WebSocketHandlerRegistry;

@Configuration
@EnableWebSocket
@RequiredArgsConstructor
public class ChatWebSocketConfig implements WebSocketConfigurer {

    private final ChatWebSocketHandler handler;
    private final ChatWebSocketHandshakeInterceptor interceptor;
    private final EventWebSocketHandler eventHandler;
    private final EventWebSocketHandshakeInterceptor eventInterceptor;
    private final LiveVoiceWebSocketHandler liveVoiceHandler;
    private final LiveVoiceHandshakeInterceptor liveVoiceInterceptor;

    @Value("${app.cors.allowed-origins:http://localhost:5173,http://127.0.0.1:5173,http://localhost:3000,http://127.0.0.1:3000}")
    private String allowedOrigins;

    @Override
    public void registerWebSocketHandlers(WebSocketHandlerRegistry registry) {
        registry.addHandler(handler, "/ws/chat")
                .addInterceptors(interceptor)
                .setAllowedOriginPatterns(allowedOrigins.split(","));
        registry.addHandler(eventHandler, "/ws/events")
                .addInterceptors(eventInterceptor)
                .setAllowedOriginPatterns(allowedOrigins.split(","));
        registry.addHandler(liveVoiceHandler, "/ws/live-voice")
                .addInterceptors(liveVoiceInterceptor)
                .setAllowedOriginPatterns(allowedOrigins.split(","));
    }
}
