package com.ragapi.dto;

import lombok.Data;

@Data
public class OpenTutorSessionRequest {
    private String studentId;
    private String courseId;
    private String classId;
    private String topic;
    private String goal;
}
