package com.ragapi.dto;

import lombok.Data;

@Data
public class IntentGuardRequest {
    private String message;
    private String question;
    private String courseId;
    private String mode;
    private String subIntent;
    private String domain;
    private String reason;
    private Double confidence;
}
