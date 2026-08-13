package com.ragapi.dto.cotraining;

import lombok.Data;
import java.time.LocalDateTime;

@Data
public class CreateExpertTaskRequest {
    private String courseId;
    private String chapter;
    private String type;
    private Integer priority;
    private String sourceGapId;
    private String title;
    private String instructions;
    private String createdBy;
    private LocalDateTime dueAt;
}
