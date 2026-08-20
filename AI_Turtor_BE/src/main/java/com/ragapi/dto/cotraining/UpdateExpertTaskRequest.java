package com.ragapi.dto.cotraining;

import lombok.Data;

import java.time.LocalDateTime;

@Data
public class UpdateExpertTaskRequest {
    private String title;
    private String instructions;
    private Integer priority;
    private LocalDateTime dueAt;
    private String status;
    private String assigneeId;
    private String assigneeTier;
}
