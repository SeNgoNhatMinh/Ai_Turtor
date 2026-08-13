package com.ragapi.dto.cotraining;

import lombok.Data;

@Data
public class ExpertReviewRequest {
    private String reviewerId;
    private String reviewerRole;
    private String reviewNote;
    private String rejectionReason;
}
