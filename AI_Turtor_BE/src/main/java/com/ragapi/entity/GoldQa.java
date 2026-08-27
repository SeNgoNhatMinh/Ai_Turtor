package com.ragapi.entity;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;

@Document(collection = "gold_qa")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class GoldQa {
    @Id
    private String id;
    private String courseId;
    private String chapter;
    private String question;
    /** Teacher-authored key points used only to guide the second AI exam. */
    private String goldAnswer;
    /** Final second-exam AI answer selected by Senior for indexing into RAG. */
    private String approvedAnswer;
    private String difficulty; // EASY, MEDIUM, HARD
    private String usage; // TRAINING or EVALUATION
    private Boolean holdout;
    private String status; // DRAFT, PENDING_REVIEW, APPROVED, INDEXED, REJECTED
    private Integer version;
    private String authorId;
    private String sourceTaskId;
    private String rubricId;
    private String reviewedBy;
    private String reviewNote;
    private String rejectionReason;
    private String examAiAnswer;
    private Double examScore;
    private Double examRagConfidence;
    private Boolean examPassed;
    private Boolean examHallucinated;
    private String examError;
    /** First exam: textbook/RAG only (no teacher teaching note). */
    private String examBaselineAiAnswer;
    private Double examBaselineScore;
    private Double examBaselineRagConfidence;
    private Boolean examBaselinePassed;
    /** True after retake that injects teacher goldAnswer as draft teaching note. */
    private Boolean examUsedTeachingNote;
    private LocalDateTime examinedAt;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    private LocalDateTime reviewedAt;
    private LocalDateTime indexedAt;
}
