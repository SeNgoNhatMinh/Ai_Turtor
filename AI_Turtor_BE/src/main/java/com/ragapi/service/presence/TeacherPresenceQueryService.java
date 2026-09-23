package com.ragapi.service.presence;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

/** Read API used by mentor selection and routing services. */
@Service
@RequiredArgsConstructor
public class TeacherPresenceQueryService {

    private final TeacherPresenceGateway gateway;

    public boolean isOnline(String teacherId) {
        return teacherId != null && !teacherId.isBlank() && gateway.isOnline(teacherId.trim());
    }
}
