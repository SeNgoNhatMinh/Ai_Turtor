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
import java.util.Map;

@Document(collection = "adaptive_learning_reviews")
@CompoundIndex(name = "adaptive_review_cycle_unique", def = "{'studentId':1,'courseId':1,'completedSessionCount':1}", unique = true)
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
    @Transient
    private String studentEmail;
    private String studentName;
    private String courseId;
    private String classId;
    private Integer completedSessionCount;
    private List<String> sessionIds;
    private String status;
    private String currentSupportLevel;
    private String suggestedSupportLevel;
    private Integer overallPercent;
    private Integer knowledgePercent;
    private Integer practicePercent;
    private Integer independencePercent;
    private Integer confidencePercent;
    private String summary;
    private List<String> strengths;
    private List<String> knowledgeGaps;
    private List<String> teachingRecommendations;
    private List<Map<String, Object>> evidence;
    private String teacherId;
    private String teacherFeedback;
    private String teacherDecision;
    private String appliedDirectiveId;
    private String evaluationError;
    private LocalDateTime createdAt;
    private LocalDateTime reviewedAt;
    private LocalDateTime updatedAt;
}
