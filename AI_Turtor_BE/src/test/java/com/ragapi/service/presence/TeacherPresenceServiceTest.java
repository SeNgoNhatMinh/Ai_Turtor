package com.ragapi.service.presence;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.Duration;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class TeacherPresenceServiceTest {

    private TeacherPresenceGateway gateway;
    private TeacherPresenceService service;

    @BeforeEach
    void setUp() {
        gateway = mock(TeacherPresenceGateway.class);
        service = new TeacherPresenceService(gateway);
        ReflectionTestUtils.setField(service, "ttlSeconds", 45L);
    }

    @Test
    void teacherConnectionCreatesExpiringPresenceLease() {
        when(gateway.refresh("teacher-1", "socket-1", Duration.ofSeconds(45))).thenReturn(true);

        var transition = service.connect("teacher-1", "TEACHER", "socket-1");

        assertThat(transition.online()).isTrue();
        assertThat(transition.changed()).isTrue();
        verify(gateway).refresh("teacher-1", "socket-1", Duration.ofSeconds(45));
    }

    @Test
    void heartbeatRefreshesTheSameLease() {
        service.heartbeat("teacher-1", "MENTOR", "socket-1");

        verify(gateway).refresh("teacher-1", "socket-1", Duration.ofSeconds(45));
    }

    @Test
    void studentConnectionDoesNotCreateTeacherPresence() {
        var transition = service.connect("student-1", "STUDENT", "socket-1");

        assertThat(transition.changed()).isFalse();
        assertThat(transition.online()).isFalse();
    }

    @Test
    void teacherOnlyBecomesOfflineAfterLastSharedLeaseIsRemoved() {
        when(gateway.remove("teacher-1", "socket-1")).thenReturn(false);
        when(gateway.remove("teacher-1", "socket-2")).thenReturn(true);

        assertThat(service.disconnect("teacher-1", "TEACHER", "socket-1").changed()).isFalse();
        var finalTransition = service.disconnect("teacher-1", "TEACHER", "socket-2");

        assertThat(finalTransition.changed()).isTrue();
        assertThat(finalTransition.online()).isFalse();
    }
}
