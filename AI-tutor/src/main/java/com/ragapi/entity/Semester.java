package com.ragapi.entity;

import com.fasterxml.jackson.annotation.JsonAlias;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;

@Document(collection = "semesters")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Semester {

    @Id
    private String id;

    @JsonAlias({"semesterId", "code"})
    private String semesterCode;
    private String name;
    private String status;
    private LocalDateTime startedAt;
    private LocalDateTime endedAt;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
