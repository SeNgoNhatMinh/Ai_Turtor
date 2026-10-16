package com.ragapi.entity;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "ai_worker_trace_events")
public class AiWorkerTraceEvent {
    @Id
    private String id;
    private String traceId;
    private String workerId;
    private String workerName;
    private String stage;
    private String status;
    private String model;
    private Long durationMs;
    private String detail;
    private LocalDateTime createdAt;
}