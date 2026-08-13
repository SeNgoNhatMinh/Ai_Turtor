package com.ragapi.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class StudentEnrollmentItem {
    private String studentId;
    private String studentCode;
    private String studentName;
    private String studentEmail;
    private String studentPhone;
}