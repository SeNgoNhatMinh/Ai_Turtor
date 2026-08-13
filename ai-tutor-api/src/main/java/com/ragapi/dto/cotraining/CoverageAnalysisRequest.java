package com.ragapi.dto.cotraining;

import lombok.Data;

import java.time.LocalDateTime;
import java.util.List;

@Data
public class CoverageAnalysisRequest {
    private String courseId;
    /** Optional when useSuggestedOrConfirmedChapters=true */
    private List<String> chapters;
    private Integer minimumTrainingGoldPerChapter;
    private Integer minimumEvaluationGoldPerChapter;
    private String requestedBy;
    private Boolean createTasks;
    /** When true (default), resolve chapters from confirmed/suggested outlines if chapters omitted. */
    private Boolean useSuggestedOrConfirmedChapters;
    /** When true (default), skip Gold Q&A tasks for chapters with MATERIAL_OK unless flags below are set. */
    private Boolean smartTaskPolicy;
    /** Create TRAINING tasks even when material is already sufficient. */
    private Boolean includeTrainingGoldTasks;
    /** Create EVALUATION holdout tasks for benchmark. */
    private Boolean includeBenchmarkTasks;
    /** Applied to expert tasks auto-created during coverage analyze. */
    private LocalDateTime taskDueAt;
}
