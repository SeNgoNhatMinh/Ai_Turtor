package com.ragapi.entity;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "quiz_assignments")
public class QuizAssignment {

    @Id
    private String id;

    private String teacherId;
    private String courseId;
    private String classId;
    private String title;
    private String topic;
    private String suggestionText;
    /** AUTO, TEACHER_MANUAL or AI_ASSISTED. */
    private String gradingMode;

    /** DRAFT, PUBLISHED, CLOSED */
    private String status;

    /** CLASS or SELECTED_STUDENTS */
    private String targetType;

    @Builder.Default
    private List<String> targetStudentIds = new ArrayList<>();

    @Builder.Default
    private List<QuizSession.QuizQuestion> questions = new ArrayList<>();

    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    private LocalDateTime publishedAt;
}
