package com.ragapi.entity;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;
import java.util.List;

@Document(collection = "improve_plans")
@CompoundIndex(name = "student_course_plan_idx", def = "{'studentId': 1, 'courseId': 1, 'status': 1}")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ImprovePlan {

    @Id
    private String id;

    private String studentId;
    private String courseId;
    private String classId;

    private String riskLevel;
    private List<String> weakTopics;
    private List<String> planItems;
    private List<String> evidence;

    private String status;
    private String generatedBy;
    private LocalDateTime generatedAt;
    private LocalDateTime completedAt;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}