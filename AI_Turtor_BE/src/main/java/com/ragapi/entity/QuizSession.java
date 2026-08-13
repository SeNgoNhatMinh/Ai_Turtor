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
@Document(collection = "quiz_sessions")
public class QuizSession {

    @Id
    private String id;

    private String studentId;
    private String courseId;
    private String classId;
    private String topic;
    private String suggestionText;
    private String assignmentId;
    /** SELF_PRACTICE or ASSIGNED */
    private String quizType;
    private String teacherId;
    private String gradingMode;

    /** GENERATED -> SUBMITTED */
    private String status;

    private Integer score;
    private Integer maxScore;
    private Double percentage;
    private String teacherReviewStatus;
    private Integer teacherReviewedScore;
    private String teacherFeedback;
    private LocalDateTime teacherReviewedAt;

    @Builder.Default
    private List<QuizQuestion> questions = new ArrayList<>();

    @Builder.Default
    private List<QuizAnswer> answers = new ArrayList<>();

    private LocalDateTime createdAt;
    private LocalDateTime submittedAt;
    private LocalDateTime updatedAt;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class QuizQuestion {
        private String questionId;
        /** MULTIPLE_CHOICE or TRUE_FALSE */
        private String type;
        private String questionText;
        @Builder.Default
        private List<String> options = new ArrayList<>();
        private String correctAnswer;
        private String explanation;
        @Builder.Default
        private List<String> sourceMaterialIds = new ArrayList<>();
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class QuizAnswer {
        private String questionId;
        private String selectedAnswer;
        private Boolean correct;
        private String correctAnswer;
        private String explanation;
    }
}
