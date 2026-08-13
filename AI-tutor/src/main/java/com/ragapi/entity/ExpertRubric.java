package com.ragapi.entity;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;
import java.util.Map;

@Document(collection = "expert_rubrics")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ExpertRubric {
    @Id
    private String id;
    private String courseId;
    private String chapter;
    private String name;
    private String description;
    private Map<String, Double> criteriaWeights;
    private String status; // DRAFT, PENDING_REVIEW, APPROVED, REJECTED
    private Integer version;
    private String authorId;
    private String sourceTaskId;
    private String reviewedBy;
    private String reviewNote;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    private LocalDateTime reviewedAt;
}
