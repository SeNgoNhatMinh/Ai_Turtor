package com.ragapi.dto;

import lombok.Builder;
import lombok.Data;

import java.util.List;

@Data
@Builder
public class QuizAttemptPageResponse {
    private String teacherId;
    private int page;
    private int size;
    private long totalElements;
    private int totalPages;
    private List<QuizAttemptSummary> attempts;
}
