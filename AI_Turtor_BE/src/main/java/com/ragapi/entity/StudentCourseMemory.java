package com.ragapi.entity;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "student_course_memories")
@CompoundIndex(name = "student_course_unique_idx", def = "{'studentId': 1, 'courseId': 1}", unique = true)
public class StudentCourseMemory {

    @Id
    private String id;

    private String studentId;
    private String courseId;
    private String classId;

    private String summary;

    @Builder.Default
    private List<String> weakTopics = new ArrayList<>();

    @Builder.Default
    private List<String> learnedTopics = new ArrayList<>();

    @Builder.Default
    private List<String> recentQuestions = new ArrayList<>();

    @Builder.Default
    private List<String> recentAnswers = new ArrayList<>();

    @Builder.Default
    private List<String> improveSuggestions = new ArrayList<>();

    @Builder.Default
    private List<String> pinnedImproveSuggestions = new ArrayList<>();

    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}






