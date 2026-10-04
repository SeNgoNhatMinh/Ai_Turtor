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
public class UnderstandingCheckResultResponse {

    private String status;
    private String attemptId;
    private String messageId;
    private String selectedKey;
    private boolean correct;
    private String correctKey;
    private String correctOptionText;
    private String explanation;
    private LocalDateTime answeredAt;
}
