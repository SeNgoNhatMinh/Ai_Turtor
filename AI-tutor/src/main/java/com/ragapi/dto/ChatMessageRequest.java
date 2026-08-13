package com.ragapi.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * ChatMessageRequest - Request �'�f gửi tin nhắn
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ChatMessageRequest {
    private String chatRoomId;
    private String senderId;
    private String senderName;
    private String senderRole; // "STUDENT" hoặc "MENTOR"
    private String content;
    private String messageType; // "TEXT", "IMAGE", "FILE"
    private String attachmentUrl; // URL ảnh/file nếu có
    private String attachmentName;
}
