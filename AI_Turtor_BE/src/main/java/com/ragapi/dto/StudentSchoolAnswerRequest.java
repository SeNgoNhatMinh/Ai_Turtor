package com.ragapi.dto;

import lombok.Data;

@Data
public class StudentSchoolAnswerRequest {
    private String courseId;
    private String classId;
    private String question;
    private String provider;
    private String model;
}
