package com.ragapi.entity;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.annotation.Transient;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Document(collection = "adaptive_learning_reviews")
@CompoundIndex(name = "adaptive_review_window_idx",
        def = "{'studentId':1,'courseId':1,'classId':1,'windowNumber':1}")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AdaptiveLearningReview {
    @Id
    private String id;
    private String studentId;
    @Transient
    private String studentName;
    @Transient
    private String studentCode;
    private String courseId;
    private String classId;
    private Integer windowNumber;
    @Builder.Default
    private List<String> sessionIds = new ArrayList<>();
    @Builder.Default
    private List<String> conversationIds = new ArrayList<>();
    private Integer completedSessionCount;
    private Integer studentMessageCount;
    private Integer evidenceCoveragePercent;
    private Integer overallUnderstandingPercent;
    private Integer knowledgePercent;
    private Integer practicePercent;
    private Integer independencePercent;
    private Integer assessmentConfidencePercent;
    private String suggestedSupportLevel;
    private String appliedSupportLevel;
    private Boolean autoApplied;
    private String recommendation;
    @Builder.Default
    private List<String> strengths = new ArrayList<>();
    @Builder.Default
    private List<String> knowledgeGaps = new ArrayList<>();
    @Builder.Default
    private List<EvidenceLog> evidenceLogs = new ArrayList<>();
    /** PENDING, APPROVED, MODIFIED, REJECTED, FAILED. */
    private String status;
    private String teacherFeedback;
    private String reviewedBy;
    private LocalDateTime reviewedAt;
    private String evaluationError;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class EvidenceLog {
        private String sessionId;
        private String conversationId;
        private String role;
        private String content;
        private String topic;
        private String phase;
        private LocalDateTime createdAt;
    }
}
