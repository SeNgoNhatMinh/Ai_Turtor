package com.ragapi.entity;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;

@Document(collection = "knowledge_candidates")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class KnowledgeCandidate {

    @Id
    private String id;

    private String questionEscalationId;
    private String mentorAnswerId;
    private String aiAnswerReviewId;

    private String courseId;
    private String classId;
    private String teacherId;

    /**
     * Only reusable learning knowledge should be approved into RAG brain.
     * Allowed to index: ACADEMIC_KNOWLEDGE, MATERIAL_CORRECTION, FAQ_CLARIFICATION.
     */
    private String candidateType;

    /**
     * TEACHER_ESCALATION or AI_ANSWER_REVIEW.
     */
    private String sourceType;

    private String question;
    private String answer;
    private String content;

    /**
     * PENDING_SENIOR_REVIEW -> INDEXED or REJECTED
     */
    private String status;

    private String reviewedBy;
    private String reviewerRole;
    private String reviewerName;
    private String reviewNote;
    private String rejectionReason;
    private LocalDateTime reviewedAt;
    private LocalDateTime indexedAt;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}