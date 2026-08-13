package com.ragapi.entity;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;
import java.util.Map;

@Document(collection = "harness_logs")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class HarnessLog {

    @Id
    private String id;

    private String traceId;
    private String sessionId;
    private String conversationId;

    private String studentId;
    private String courseId;
    private String classId;

    private String workflowName;
    private String nodeName;
    private String mode;

    /** INFO, NODE_STARTED, NODE_COMPLETED, ERROR, FALLBACK, ESCALATION_CREATED. */
    private String eventType;

    /** SUCCESS, FAILED, SKIPPED, RECOVERED. */
    private String status;

    private String errorType;
    private String errorMessage;
    private String errorStack;

    private Map<String, Object> requestPayload;
    private Map<String, Object> responsePayload;
    private Map<String, Object> metadata;

    private LocalDateTime createdAt;
}
