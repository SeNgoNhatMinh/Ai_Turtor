package com.ragapi.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ExistingAcademicKnowledge {

    private String id;
    private String question;
    private String answer;
    private String courseId;
    private String status;
    private LocalDateTime indexedAt;
}
