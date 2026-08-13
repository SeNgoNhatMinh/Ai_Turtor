package com.ragapi.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class EnrollStudentsRequest {
    private String semesterId;
    private String courseName;
    private String className;
    private String status;
    private List<StudentEnrollmentItem> students;
}