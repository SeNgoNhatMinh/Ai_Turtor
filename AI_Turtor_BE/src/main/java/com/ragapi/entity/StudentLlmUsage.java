package com.ragapi.entity;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;

@Document(collection = "student_llm_usage")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class StudentLlmUsage {
    @Id
    private String id;
    @Indexed
    private String userId;
    private String provider;
    private String model;
    private String status;
    private LocalDateTime createdAt;
}
