package com.ragapi.entity;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

/**
 * One retrieval decision. APPLIED means the behavior was placed in the tutor
 * prompt. SKIPPED means it was assigned but not selected. FAILED means
 * retrieval could not finish.
 */
@Document(collection = "teaching_behavior_executions")
@CompoundIndex(name = "behavior_execution_idx", def = "{'behaviorId':1,'timestamp':-1}")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TeachingBehaviorExecution {
    public static final String APPLIED = "APPLIED";
    public static final String SKIPPED = "SKIPPED";
    public static final String FAILED = "FAILED";

    @Id
    private String id;
    private String studentId;
    private String courseId;
    private String classId;
    private String sessionId;
    private String behaviorId;
    private Integer behaviorVersion;
    private String appliedBehaviorId;
    private String selectedStrategy;
    private String selectionReason;
    @Builder.Default
    private List<String> matchedConditions = new ArrayList<>();
    private String executionStatus;
    private LocalDateTime timestamp;
}
