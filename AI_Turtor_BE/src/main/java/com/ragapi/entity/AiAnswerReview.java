package com.ragapi.entity;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;

@Document(collection = "ai_answer_reviews")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AiAnswerReview {

    @Id
    private String id;

    private String studentId;
    private String courseId;
    private String classId;
    private String conversationId;
    private String questionEscalationId;

    private String mode;

    /**
     * QUALITY_FEEDBACK, ANSWER_DISPUTE, SOURCE_CONFLICT, MISSING_MATERIAL,
     * OPERATIONAL_POLICY, GRADING_DECISION, CLASS_RULE, ASSIGNMENT_SPECIFIC.
     */
    private String reviewType;

    private String question;
    private String answer;

    /**
     * Hash of courseId + normalized question + answer — groups independent student reviews
     * on the same AI response for crowd-sourced escalation.
     */
    private String answerFingerprint;

    /**
     * MODERATE (2-3 stars crowd), SEVERE (1 star crowd), IMMEDIATE (source conflict).
     */
    private String escalationTier;

    private Double aiConfidence;

    /**
     * 1-5 rating from the reviewer.
     */
    private Integer rating;
    private Boolean accurate;
    private Boolean helpful;
    private String correctnessLevel;
    private String feedback;
    private String suggestedCorrection;

    private String reviewedBy;
    private String reviewerRole;

    /**
     * SUBMITTED -> NEEDS_MENTOR_REVIEW / NEEDS_SENIOR_REVIEW -> RESOLVED
     */
    private String status;

    private String seniorReviewerId;
    private String seniorReviewerName;
    private String seniorReviewDecision;
    private String seniorReviewNotes;
    private String linkedKnowledgeCandidateId;

    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    private LocalDateTime seniorReviewedAt;
}