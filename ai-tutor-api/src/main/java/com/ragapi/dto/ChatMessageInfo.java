package com.ragapi.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 * ChatMessageInfo - Chi tiết tin nhắn trong l�<ch sử
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ChatMessageInfo {
    private String messageId;
    private String senderId;
    private String senderName;
    private String senderRole;
    private String senderAvatarUrl;
    private String content;
    private String messageType;
    private LocalDateTime sentAt;
    private String status;
    private String attachmentUrl;
    private String attachmentName;
}
