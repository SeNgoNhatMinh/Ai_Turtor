package com.ragapi.dto;

import lombok.Data;

@Data
public class SubscriptionPlanRequest {
    private String code;
    private String name;
    private String description;
    private Integer durationDays;
    private Double price;
    private String currency;
    private Boolean isActive;
}






