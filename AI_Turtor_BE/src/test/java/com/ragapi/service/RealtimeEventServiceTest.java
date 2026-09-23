package com.ragapi.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.web.socket.WebSocketSession;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class RealtimeEventServiceTest {

    private final RealtimeEventService service = new RealtimeEventService(new ObjectMapper());

    @Test
    void teacherRemainsOnlineUntilLastRealtimeSessionCloses() {
        WebSocketSession first = session("teacher-1", "TEACHER");
        WebSocketSession second = session("teacher-1", "TEACHER");

        service.register(first);
        service.register(second);
        assertThat(service.isUserOnline("teacher-1")).isTrue();

        service.unregister(first);
        assertThat(service.isUserOnline("teacher-1")).isTrue();

        service.unregister(second);
        assertThat(service.isUserOnline("teacher-1")).isFalse();
    }

    @Test
    void unknownTeacherIsOffline() {
        assertThat(service.isUserOnline("teacher-offline")).isFalse();
        assertThat(service.isUserOnline(null)).isFalse();
    }

    private WebSocketSession session(String userId, String role) {
        WebSocketSession session = mock(WebSocketSession.class);
        when(session.getAttributes()).thenReturn(Map.of("userId", userId, "role", role));
        when(session.isOpen()).thenReturn(true);
        return session;
    }
}
