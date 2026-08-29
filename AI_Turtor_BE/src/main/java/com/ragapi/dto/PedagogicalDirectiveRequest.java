package com.ragapi.dto;

import lombok.Data;

import java.time.LocalDateTime;

@Data
public class PedagogicalDirectiveRequest {
    private String studentId;
    private String courseId;
    private String classId;
    private String topic;
    private String instruction;
    private String supportLevel;
    private Integer priority;
    private LocalDateTime effectiveUntil;
}
