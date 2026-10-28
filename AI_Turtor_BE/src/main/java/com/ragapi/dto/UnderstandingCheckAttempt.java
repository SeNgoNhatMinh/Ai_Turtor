package com.ragapi.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 * One recorded attempt at one understanding-check item of an AI answer.
 * An answer can carry several quiz items (Q1..Qn by support level); every
 * item the student answers is stored separately so adaptive reviews see
 * exactly which questions were answered correctly or incorrectly.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UnderstandingCheckAttempt {

    private int quizIndex;
    private String attemptId;
    private UnderstandingCheckPayload check;
    private String selectedKey;
    private Boolean correct;
    private LocalDateTime answeredAt;
}
