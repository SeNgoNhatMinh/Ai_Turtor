package com.ragapi.entity;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;
import java.util.Map;

@Document(collection = "eval_runs")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class EvalRun {
    @Id
    private String id;
    private String courseId;
    private String chapter;
    private String status; // QUEUED, RUNNING, PASSED, FAILED, ERROR
    private String harnessVersion;
    private String kbVersion;
    private String promptVersion;
    private Integer totalCases;
    private Integer passedCases;
    private Double averageScore;
    private Double hallucinationRate;
    private Double passThreshold;
    private Boolean regressionDetected;
    private String baselineRunId;
    private Map<String, Double> metrics;
    private String error;
    private String triggeredBy;
    private LocalDateTime createdAt;
    private LocalDateTime startedAt;
    private LocalDateTime completedAt;
}
