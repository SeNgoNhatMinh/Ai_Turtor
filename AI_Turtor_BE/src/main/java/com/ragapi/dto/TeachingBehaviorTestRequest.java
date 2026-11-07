package com.ragapi.dto;

import lombok.Data;

@Data
public class TeachingBehaviorTestRequest {
    private String question;
    private String courseId;
    private String studentId;
}
