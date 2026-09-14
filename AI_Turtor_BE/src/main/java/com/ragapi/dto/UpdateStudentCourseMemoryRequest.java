package com.ragapi.dto;

import com.ragapi.entity.StudentWeakTopic;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class UpdateStudentCourseMemoryRequest {
    private String classId;
    private String summary;
    private List<String> weakTopics;
    private List<StudentWeakTopic> weakTopicDetails;
    private List<String> learnedTopics;
    private List<String> recentQuestions;
    private List<String> recentAnswers;
    private List<String> improveSuggestions;
    private List<String> pinnedImproveSuggestions;
}






