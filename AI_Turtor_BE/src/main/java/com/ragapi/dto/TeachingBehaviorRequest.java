package com.ragapi.dto;

import lombok.Data;

import java.util.List;

@Data
public class TeachingBehaviorRequest {
    private String scope;
    private String studentId;
    private String courseId;
    private String classId;
    private String domain;
    private String name;
    private String description;
    private String strategy;
    private List<String> applicableTopics;
    private String applicabilityConditions;
    private Integer priority;
    private List<String> supportLevels;
    private String instruction;
    private List<String> targetSignals;
}
