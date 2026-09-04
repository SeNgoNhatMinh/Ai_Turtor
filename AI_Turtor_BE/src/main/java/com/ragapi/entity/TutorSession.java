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

@Document(collection = "tutor_sessions")
@CompoundIndex(name = "student_course_session_idx", def = "{'studentId':1,'courseId':1,'updatedAt':-1}")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TutorSession {
    @Id
    private String id;
    private String studentId;
    @Transient
    private String studentName;
    @Transient
    private String studentCode;
    @Transient
    private String studentEmail;
    @Transient
    private Integer studentTurnCount;
    private String courseId;
    private String classId;
    private String topic;
    private String goal;
    /** ACTIVE, COMPLETED, ABANDONED. */
    private String status;
    /** OPEN, DIAGNOSTIC, TEACH, PRACTICE, REFLECT, CLOSED. */
    private String phase;
    /** HIGH_SUPPORT, STANDARD, CHALLENGE. Dynamic per session/topic. */
    private String supportLevel;
    @Builder.Default
    private List<String> conversationIds = new ArrayList<>();
    @Builder.Default
    private List<String> suggestedTopics = new ArrayList<>();
    private String summaryId;
    private LocalDateTime startedAt;
    private LocalDateTime updatedAt;
    private LocalDateTime completedAt;
}
