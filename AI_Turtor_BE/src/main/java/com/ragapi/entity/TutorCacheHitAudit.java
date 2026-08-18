package com.ragapi.entity;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;

@Document(collection = "tutor_cache_hit_audits")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TutorCacheHitAudit {
    @Id
    private String id;
    private String matchedCacheId;
    private String courseId;
    private String classId;
    private String hitType;
    private Double similarity;
    private long cacheLookupMs;
    private long backendProcessingMs;
    private LocalDateTime createdAt;
    private LocalDateTime expiresAt;
}
