package com.ragapi.entity;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 * ChatMessage Entity - Lưu trữ tin nhắn trong chat room
 */
@Document(collection = "chat_messages")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ChatMessage {
    @Id
    private String id;
    
    // Chat Room Reference
    private String chatRoomId; // ID phòng chat
    
    // Sender Info
    private String senderId; // User ID hoặc Mentor ID
    private String senderName; // Tên người gửi
    private String senderEmail; // Email người gửi
    private String senderRole; // "STUDENT" hoặc "MENTOR"
    private String senderAvatarUrl; // Ảnh �'ại di�?n người gửi
    
    // Message Content
    private String content; // N�Ti dung tin nhắn
    private String messageType; // "TEXT", "IMAGE", "FILE", "SYSTEM"
    private String attachmentUrl; // URL attachment nếu có (image, file, etc.)
    private String attachmentName; // Tên file/image
    
    // Status
    private String status; // "SENT", "DELIVERED", "READ"
    private LocalDateTime sentAt;
    private LocalDateTime deliveredAt;
    private LocalDateTime readAt;
    
    // Metadata
    private Integer charCount; // S�' ký tự
    private Boolean isEdited; // Tin nhắn có b�< edit không?
    private LocalDateTime editedAt;
    private String editedContent; // N�Ti dung trư�>c edit (nếu edited)
    
    // AI Enhancement (optional)
    private Boolean hasAISuggestion; // Có suggestion từ AI không?
    private String aiSuggestion; // Gợi ý từ AI nếu có
}






