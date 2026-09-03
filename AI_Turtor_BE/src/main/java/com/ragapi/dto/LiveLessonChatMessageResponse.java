package com.ragapi.dto;

import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@Builder
public class LiveLessonChatMessageResponse {
    private String id;
    private String lessonId;
    private String senderId;
    private String senderName;
    private String senderRole;
    private String content;
    private LocalDateTime createdAt;
}
