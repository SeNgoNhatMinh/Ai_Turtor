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

@Document(collection = "tutor_session_summaries")
@CompoundIndex(name = "class_student_summary_idx", def = "{'courseId':1,'classId':1,'studentId':1,'createdAt':-1}")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TutorSessionSummary {
    @Id
    private String id;
    private String sessionId;
    private String studentId;
    @Transient
    private String studentName;
    @Transient
    private String studentCode;
    @Transient
    private String studentEmail;
    private String courseId;
    private String classId;
    private String topic;
    private String supportLevel;
    private String summaryText;
    @Builder.Default
    private List<String> topicsCovered = new ArrayList<>();
    @Builder.Default
    private List<String> misconceptions = new ArrayList<>();
    @Builder.Default
    private List<String> strengths = new ArrayList<>();
    @Builder.Default
    private List<String> recommendedNextSteps = new ArrayList<>();
    @Builder.Default
    private List<String> conversationIds = new ArrayList<>();
    private Integer studentTurnCount;
    private String generationMethod;
    private LocalDateTime createdAt;
    private LocalDateTime sharedWithTeacherAt;
}
