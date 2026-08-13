package com.ragapi.entity;

import com.fasterxml.jackson.annotation.JsonAlias;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;

@Document(collection = "class_sections")
@CompoundIndex(name = "course_class_unique_idx", def = "{'courseId': 1, 'classId': 1}", unique = true)
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ClassSection {

    @Id
    private String id;

    @JsonAlias("semesterCode")
    private String semesterId;
    @JsonAlias("courseCode")
    private String courseId;
    @JsonAlias("courseTitle")
    private String courseName;
    private String classId;
    @JsonAlias({"name", "sectionName"})
    private String className;

    @JsonAlias("mentorId")
    private String teacherId;
    @JsonAlias("mentorName")
    private String teacherName;
    private String teacherEmail;

    /**
     * ACTIVE means questions should route to the class teacher.
     * COMPLETED means mentor matching may be used.
     */
    private String status;

    private LocalDateTime startedAt;
    private LocalDateTime endedAt;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
