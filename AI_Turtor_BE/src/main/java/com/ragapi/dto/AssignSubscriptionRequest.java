package com.ragapi.dto;

import lombok.Data;

import java.time.LocalDateTime;

@Data
public class AssignSubscriptionRequest {
    private String userId;
    private String planId;
    private String planCode;
    private LocalDateTime startAt;
}






