package com.ragapi.entity;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;

@Document(collection = "mentor_answers")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class MentorAnswer {

    @Id
    private String id;

    private String questionEscalationId;
    private String teacherId;
    private String teacherName;

    private String courseId;
    private String classId;

    private String question;
    private String answer;

    private LocalDateTime answeredAt;
    private LocalDateTime createdAt;
}
