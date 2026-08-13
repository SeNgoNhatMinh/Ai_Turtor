package com.ragapi.dto.cotraining;

import lombok.Data;

import java.time.LocalDateTime;

@Data
public class CreateChapterTasksRequest {
    private String courseId;
    private String chapter;
    private String createdBy;
    private Boolean includeTrainingGoldTask;
    private Boolean includeEvaluationGoldTask;
    /** Optional deadline shown to teachers on the task board. */
    private LocalDateTime dueAt;
}
