package com.ragapi.entity;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;

/**
 * A runtime assignment of a reusable {@link TeachingBehavior} template.
 * Student-specific wording stays here and is not copied back onto the template.
 */
@Document(collection = "applied_teaching_behaviors")
@CompoundIndex(name = "applied_behavior_idx", def = "{'behaviorId':1,'courseId':1,'studentId':1,'status':1}")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AppliedTeachingBehavior {
    public static final String STATUS_ACTIVE = "ACTIVE";
    public static final String STATUS_INACTIVE = "INACTIVE";

    @Id
    private String id;
    private String behaviorId;
    private String courseId;
    private String classId;
    /** Null means the assignment covers the whole course. */
    private String studentId;
    private String customizedInstructions;
    private Integer priorityOverride;
    private String status;
    private LocalDateTime effectiveFrom;
    private LocalDateTime effectiveUntil;
    private String assignedBy;
    private String assignedByName;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
