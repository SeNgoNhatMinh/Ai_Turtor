package com.ragapi.entity;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.index.CompoundIndexes;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;

@Document(collection = "course_material_index_jobs")
@CompoundIndexes({
        @CompoundIndex(name = "material_index_job_idempotency_uq", def = "{'idempotencyKey': 1}", unique = true),
        @CompoundIndex(name = "material_index_job_queue_idx", def = "{'status': 1, 'nextAttemptAt': 1, 'createdAt': 1}")
})
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CourseMaterialIndexJob {

    public static final String PENDING = "PENDING";
    public static final String PROCESSING = "PROCESSING";
    public static final String RETRY = "RETRY";
    public static final String COMPLETED = "COMPLETED";
    public static final String FAILED = "FAILED";

    @Id
    private String id;
    private String idempotencyKey;
    private String materialId;
    private String courseId;
    private String contentHash;
    private Long materialVersion;
    private String status;
    private Integer retryCount;
    private Integer maxRetries;
    private LocalDateTime nextAttemptAt;
    private LocalDateTime lockedAt;
    private LocalDateTime heartbeatAt;
    private String workerId;
    private String lastError;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    private LocalDateTime completedAt;
    private LocalDateTime failedAt;
}
