package com.ragapi.entity;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;

@Document(collection = "student_llm_credentials")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class StudentLlmCredential {
    @Id
    private String userId;
    private String provider;
    private String model;
    private String ciphertext;
    private String iv;
    private LocalDateTime updatedAt;
}
