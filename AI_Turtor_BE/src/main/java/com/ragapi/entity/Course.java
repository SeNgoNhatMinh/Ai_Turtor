package com.ragapi.entity;

import com.fasterxml.jackson.annotation.JsonAlias;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;

@Document(collection = "courses")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Course {

    @Id
    private String id;

    @JsonAlias("semesterCode")
    private String semesterId;
    @JsonAlias("courseCode")
    private String courseId;
    @JsonAlias({"name", "title"})
    private String courseName;
    private String description;
    private Integer credits;
    private String status;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
