package com.ragapi.entity;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;

@Document(collection = "expert_tasks")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ExpertTask {
    @Id
    private String id;
    private String courseId;
    private String chapter;
    private String type; // GOLD_QA, RUBRIC, RANKING, REVIEW
    private String status; // OPEN, ASSIGNED, IN_PROGRESS, SUBMITTED, COMPLETED, CANCELLED
    private String assigneeId;
    private String assigneeTier;
    private Integer priority;
    private String sourceGapId;
    private String title;
    private String instructions;
    private String contributionId;
    private String createdBy;
    private LocalDateTime dueAt;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    private LocalDateTime completedAt;
}
