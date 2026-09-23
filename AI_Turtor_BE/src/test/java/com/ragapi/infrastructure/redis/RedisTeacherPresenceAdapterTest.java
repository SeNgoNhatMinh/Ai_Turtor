package com.ragapi.infrastructure.redis;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.Duration;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;

class RedisTeacherPresenceAdapterTest {

    private RedisTeacherPresenceAdapter adapter;

    @BeforeEach
    void setUp() {
        @SuppressWarnings("unchecked")
        ObjectProvider<StringRedisTemplate> provider = mock(ObjectProvider.class);
        adapter = new RedisTeacherPresenceAdapter(provider);
        ReflectionTestUtils.setField(adapter, "redisEnabled", false);
        ReflectionTestUtils.setField(adapter, "keyPrefix", "test");
    }

    @Test
    void teacherRemainsOnlineUntilTheLastConnectionLeaseIsRemoved() {
        assertThat(adapter.refresh("teacher-1", "socket-1", Duration.ofSeconds(45))).isTrue();
        assertThat(adapter.refresh("teacher-1", "socket-2", Duration.ofSeconds(45))).isFalse();
        assertThat(adapter.isOnline("teacher-1")).isTrue();

        assertThat(adapter.remove("teacher-1", "socket-1")).isFalse();
        assertThat(adapter.isOnline("teacher-1")).isTrue();

        assertThat(adapter.remove("teacher-1", "socket-2")).isTrue();
        assertThat(adapter.isOnline("teacher-1")).isFalse();
        assertThat(adapter.remove("teacher-1", "missing-socket")).isFalse();
    }
}
