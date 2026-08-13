package com.ragapi.entity;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;

@Document(collection = "course_enrollments")
@CompoundIndex(name = "student_course_class_unique_idx", def = "{'studentId': 1, 'courseId': 1, 'classId': 1}", unique = true)
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CourseEnrollment {

    @Id
    private String id;

    private String studentId;
    private String studentCode;
    private String studentName;
    private String studentEmail;
    private String studentPhone;

    private String semesterId;
    private String courseId;
    private String courseName;
    private String classId;
    private String className;

    /**
     * ACTIVE means the class teacher owns escalation.
     * COMPLETED means the AI can use mentor matching.
     */
    private String status;

    private LocalDateTime enrolledAt;
    private LocalDateTime completedAt;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}