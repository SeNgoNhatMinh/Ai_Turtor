package com.ragapi.dto;

import lombok.Data;

import java.time.LocalDateTime;

@Data
public class AdaptiveSupportLevelLockRequest {
    private String studentId;
    private String courseId;
    private String classId;
    private String supportLevel;
    /** Optional: a lock stays active until explicitly released when omitted. */
    private LocalDateTime expiresAt;
}
