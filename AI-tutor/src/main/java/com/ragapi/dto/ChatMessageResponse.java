package com.ragapi.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 * ChatMessageResponse - Response tin nhắn
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ChatMessageResponse {
    private String messageId;
    private String chatRoomId;
    private String senderId;
    private String senderName;
    private String senderRole;
    private String senderAvatarUrl;
    private String content;
    private String messageType;
    private LocalDateTime sentAt;
    private String status; // "SENT", "DELIVERED", "READ"
}
