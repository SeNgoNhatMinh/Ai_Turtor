package com.ragapi.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Schema(description = "Senior mentor review request for a knowledge candidate")
public class KnowledgeCandidateReviewRequest {

    @Schema(description = "Reviewer ID. Must not be the same as the mentor who created the answer.", example = "SM001")
    private String reviewerId;

    @Schema(description = "Reviewer role. Only SENIOR_MENTOR or ADMIN can approve knowledge for AI learning.", example = "SENIOR_MENTOR")
    private String reviewerRole;

    @Schema(description = "Reviewer display name")
    private String reviewerName;

    @Schema(description = "Optional corrected content to index instead of the original candidate content")
    private String contentOverride;

    @Schema(description = "Approval or rejection note")
    private String reviewNote;

    @Schema(description = "Reason when rejecting this candidate")
    private String rejectionReason;
}
