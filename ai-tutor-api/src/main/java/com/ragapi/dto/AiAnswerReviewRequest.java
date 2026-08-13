package com.ragapi.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Schema(description = "Human review for an AI answer after RAG, Code Mentor, or Escalation flow")
public class AiAnswerReviewRequest {

    @Schema(description = "Student who received the answer", example = "STU001")
    private String studentId;

    @Schema(description = "Course scope", example = "PRO192")
    private String courseId;

    @Schema(description = "Optional class section context", example = "SE1840")
    private String classId;

    @Schema(description = "Conversation ID returned by AI query/code mentor", example = "uuid-conversation-id")
    private String conversationId;

    @Schema(description = "Escalation ticket ID if this review belongs to an escalation answer")
    private String questionEscalationId;

    @Schema(description = "AI mode being reviewed: RAG, CODE, or ESCALATE", example = "RAG")
    private String mode;

    @Schema(description = "Review type: QUALITY_FEEDBACK, ANSWER_DISPUTE, SOURCE_CONFLICT, MISSING_MATERIAL, KNOWLEDGE_CORRECTION, MATERIAL_CORRECTION, OPERATIONAL_POLICY, GRADING_DECISION, CLASS_RULE, ASSIGNMENT_SPECIFIC", example = "ANSWER_DISPUTE")
    private String reviewType;

    @Schema(description = "Student question or reviewed prompt")
    private String question;

    @Schema(description = "AI or mentor answer being reviewed")
    private String answer;

    @Schema(description = "AI confidence returned by backend", example = "0.85")
    private Double aiConfidence;

    @Schema(description = "Reviewer rating from 0 to 5", example = "4")
    private Integer rating;

    @Schema(description = "Whether the reviewer thinks the answer is correct")
    private Boolean accurate;

    @Schema(description = "Whether the answer helped the student")
    private Boolean helpful;

    @Schema(description = "HIGH, MEDIUM, LOW, or INCORRECT", example = "HIGH")
    private String correctnessLevel;

    @Schema(description = "Human feedback explaining the rating")
    private String feedback;

    @Schema(description = "Suggested correction when answer is incomplete or wrong")
    private String suggestedCorrection;

    @Schema(description = "Reviewer user ID")
    private String reviewedBy;

    @Schema(description = "STUDENT, HUMAN_REVIEWER, MENTOR, SENIOR_MENTOR, or ADMIN", example = "STUDENT")
    private String reviewerRole;
}