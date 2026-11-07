package com.ragapi.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.index.CompoundIndexes;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

/**
 * One reusable "how to teach" behavior. Behaviors only shape pedagogy
 * (examples, pacing, analogies, checks); they never carry course facts.
 */
@Document(collection = "teaching_behaviors")
@CompoundIndexes({
        @CompoundIndex(name = "behavior_scope_idx", def = "{'scope':1,'courseId':1,'domain':1,'status':1}"),
        @CompoundIndex(name = "behavior_student_idx", def = "{'studentId':1,'courseId':1,'status':1}"),
        @CompoundIndex(name = "behavior_review_idx", def = "{'sourceReviewId':1}")
})
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TeachingBehavior {
    public static final String SCOPE_STUDENT = "STUDENT";
    public static final String SCOPE_COURSE = "COURSE";
    public static final String SCOPE_DOMAIN = "DOMAIN";
    public static final String SCOPE_GLOBAL = "GLOBAL";

    public static final String STATUS_AI_PENDING = "AI_PENDING";
    public static final String STATUS_APPROVED = "APPROVED";
    public static final String STATUS_REJECTED = "REJECTED";
    public static final String STATUS_RETIRED = "RETIRED";

    public static final String APPROVAL_PENDING = "PENDING";
    public static final String APPROVAL_APPROVED = "APPROVED";
    public static final String APPROVAL_REJECTED = "REJECTED";

    @Id
    private String id;
    /** Short label shown in the teacher library. */
    private String name;
    private String description;
    /** One of the explanation styles, for example "Ví dụ thực tế". */
    private String strategy;
    /** Stable TeachingStrategyCatalog code when known (for example STEP_BY_STEP). */
    private String strategyCode;
    @Builder.Default
    private List<String> applicableTopics = new ArrayList<>();
    /** Free-text conditions, such as "khi sinh viên nhầm overload và override". */
    private String applicabilityConditions;
    @Builder.Default
    private int priority = 0;
    @Builder.Default
    private int version = 1;
    /** PENDING, APPROVED or REJECTED. Distinct from runtime status. */
    private String approvalStatus;
    private String updatedBy;
    /** STUDENT, COURSE, DOMAIN or GLOBAL. */
    private String scope;
    private String studentId;
    private String courseId;
    private String classId;
    private String domain;
    @Builder.Default
    private List<String> supportLevels = new ArrayList<>();
    private String instruction;
    @Builder.Default
    private List<String> targetSignals = new ArrayList<>();
    @JsonIgnore
    private List<Float> embedding;
    /** AI_PENDING, APPROVED, REJECTED or RETIRED. */
    private String status;
    private String sourceReviewId;
    /** Behavior this one was shared from, when copied to a wider scope. */
    private String sourceBehaviorId;
    private String createdBy;
    private String createdByName;
    @Builder.Default
    private long useCount = 0L;
    @Builder.Default
    private double successRate = 0.5;
    @Builder.Default
    private int outcomeCount = 0;
    private LocalDateTime lastUsedAt;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
