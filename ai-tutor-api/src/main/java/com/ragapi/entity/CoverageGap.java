package com.ragapi.entity;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;
import java.util.List;

@Document(collection = "coverage_gaps")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CoverageGap {
    @Id
    private String id;
    private String courseId;
    private String chapter;
    private String severity; // LOW, MEDIUM, HIGH, CRITICAL
    private String status; // OPEN, TASK_CREATED, RESOLVED, IGNORED
    private Integer materialCount;
    private Integer trainingGoldCount;
    private Integer evaluationGoldCount;
    /** NO_MATERIAL, MATERIAL_THIN, MATERIAL_OK */
    private String materialHealth;
    private Integer chunkCount;
    private Long approxChars;
    private List<String> reasons;
    private String resolvedBy;
    private LocalDateTime detectedAt;
    private LocalDateTime updatedAt;
    private LocalDateTime resolvedAt;
}
