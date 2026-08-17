package com.ragapi.dto;

import lombok.Data;

@Data
public class SeniorTutorAnswerCacheUpdateRequest {
    private String seniorReviewerId;
    private String seniorReviewerName;
    private String reviewerRole;
    private String correctedAnswer;
    private String notes;
}
