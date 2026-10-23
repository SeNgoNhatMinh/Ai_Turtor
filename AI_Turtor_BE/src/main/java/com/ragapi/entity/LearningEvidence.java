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

/**
 * A traceable learning record. It deliberately records the source event rather
 * than guessing that an item mentioned in a conversation was completed.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "learning_evidence")
@CompoundIndexes({
        @CompoundIndex(
                name = "learning_evidence_source_unique",
                def = "{'studentId':1,'courseId':1,'sourceType':1,'sourceRecordId':1}",
                unique = true),
        @CompoundIndex(
                name = "learning_evidence_student_course_event_idx",
                def = "{'studentId':1,'courseId':1,'eventAt':-1,'createdAt':-1}")
})
public class LearningEvidence {
    @Id
    private String id;
    private String studentId;
    private String courseId;
    private String classId;
    private String sessionId;

    /** LEARNING_INTENT, CONTENT_DELIVERY, LEARNING_ACTIVITY, ASSESSMENT_RESULT. */
    private String evidenceType;
    /** VERIFIED, UNVERIFIED, STARTED, IN_PROGRESS, COMPLETED. */
    private String status;
    private String verificationStatus;

    /** Present only when the source has an authoritative topic association. */
    private String topic;

    /** QUIZ_SUBMISSION, LESSON_ACTIVITY, ... Never inferred from free-form chat. */
    private String sourceType;
    private String sourceRecordId;
    private LocalDateTime eventAt;

    private Integer score;
    private Integer maxScore;
    private Double percentage;
    private LocalDateTime createdAt;
}
