package com.ragapi.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Schema(description = "Senior mentor resolution for a human AI answer review")
public class SeniorReviewResolutionRequest {

    @Schema(description = "Senior mentor or admin ID", example = "SM001")
    private String seniorReviewerId;

    @Schema(description = "Senior mentor or admin name")
    private String seniorReviewerName;

    @Schema(description = "Must be SENIOR_MENTOR or ADMIN", example = "SENIOR_MENTOR")
    private String reviewerRole;

    @Schema(description = "APPROVE_FEEDBACK, REJECT_FEEDBACK, or CREATE_KNOWLEDGE_CANDIDATE", example = "CREATE_KNOWLEDGE_CANDIDATE")
    private String decision;

    @Schema(description = "Senior review note")
    private String notes;

    @Schema(description = "If true, create a pending KnowledgeCandidate from the correction. It is not indexed until approved.")
    private Boolean createKnowledgeCandidate;

    @Schema(description = "Knowledge type when creating a candidate: ACADEMIC_KNOWLEDGE, MATERIAL_CORRECTION, or FAQ_CLARIFICATION", example = "ACADEMIC_KNOWLEDGE")
    private String candidateType;

    @Schema(description = "Corrected content to use for the knowledge candidate")
    private String correctedAnswer;
}