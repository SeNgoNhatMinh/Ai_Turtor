package com.ragapi.entity;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;

/** A teacher-controlled pause on automated support-level transitions. */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "adaptive_support_level_locks")
@CompoundIndex(name = "adaptive_support_lock_scope_unique", def = "{'studentId':1,'courseId':1,'classId':1}", unique = true)
public class AdaptiveSupportLevelLock {
    @Id
    private String id;
    private String studentId;
    private String courseId;
    private String classId;
    private String lockedSupportLevel;
    private boolean active;
    private String createdByTeacherId;
    private String releasedByTeacherId;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    private LocalDateTime expiresAt;
    private LocalDateTime releasedAt;
}
