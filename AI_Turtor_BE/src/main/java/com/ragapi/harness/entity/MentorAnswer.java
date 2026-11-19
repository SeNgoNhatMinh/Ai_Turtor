package com.ragapi.harness.entity;

import com.ragapi.harness.HarnessCollections;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;
import java.util.List;

@Document(collection = HarnessCollections.MENTOR_ANSWERS)
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
    private List<KnowledgeImageAttachment> images;

    private LocalDateTime answeredAt;
    private LocalDateTime createdAt;
}
