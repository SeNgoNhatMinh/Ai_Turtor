package com.ragapi.dto;

import lombok.Data;

import java.util.Map;

@Data
public class HarnessLogRequest {

    private String traceId;
    private String sessionId;
    private String conversationId;

    private String studentId;
    private String courseId;
    private String classId;

    private String workflowName;
    private String nodeName;
    private String mode;
    private String eventType;
    private String status;

    private String errorType;
    private String errorMessage;
    private String errorStack;

    private Map<String, Object> requestPayload;
    private Map<String, Object> responsePayload;
    private Map<String, Object> metadata;
}
