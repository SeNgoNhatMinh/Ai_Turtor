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
    /** How many gold Q&A tasks to open for the chapter. Default 2. */
    private Integer questionCount;
    /** Optional deadline shown to teachers on the task board. */
    private LocalDateTime dueAt;
}
