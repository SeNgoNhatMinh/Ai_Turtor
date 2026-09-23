package com.ragapi.service.presence;

import java.time.Duration;

/** Shared store contract for teacher connection leases. */
public interface TeacherPresenceGateway {

    boolean refresh(String teacherId, String connectionId, Duration ttl);

    boolean remove(String teacherId, String connectionId);

    boolean isOnline(String teacherId);
}
