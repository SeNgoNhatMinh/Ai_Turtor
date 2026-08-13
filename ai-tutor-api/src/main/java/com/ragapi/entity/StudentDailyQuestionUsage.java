package com.ragapi.entity;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDate;
import java.time.LocalDateTime;

@Document(collection = "student_daily_question_usage")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class StudentDailyQuestionUsage {
    @Id
    private String id;
    private String studentId;
    private String courseId;
    private LocalDate usageDate;
    private int questionCount;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
