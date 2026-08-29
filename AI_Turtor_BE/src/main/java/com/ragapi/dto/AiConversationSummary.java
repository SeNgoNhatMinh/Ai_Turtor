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
public class AiConversationSummary {

    private String conversationId;
    private String title;
    private String courseId;
    private String classId;
    private String tutorSessionId;
    private String parentConversationId;
    private String sessionType;
    private Integer messageCount;
    private Integer userQuestionCount;
    private Boolean maxTurnsReached;
    private LocalDateTime createdAt;
    private LocalDateTime lastMessageAt;
}