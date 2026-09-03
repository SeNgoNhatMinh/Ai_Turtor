package com.ragapi.dto;

import lombok.Data;

@Data
public class LiveLessonChatMessageRequest {
    private String content;
    private String senderName;
}
