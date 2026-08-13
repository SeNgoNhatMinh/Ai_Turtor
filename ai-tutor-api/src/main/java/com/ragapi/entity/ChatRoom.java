package com.ragapi.entity;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 * ChatRoom Entity - Phòng chat giữa User và Mentor
 */
@Document(collection = "chat_rooms")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ChatRoom {
    @Id
    private String id;

    // Participants
    private String userId;
    private String userName;
    private String userEmail;

    private String mentorId;
    private String mentorName;
    private String mentorEmail;

    // Related Request
    private String questionEscalationId; // Link t�>i QuestionEscalation

    // Context
    private String originalQuestion; // Câu hỏi g�'c
    private String aiResponse; // Response từ RAG trư�>c �'ó

    // Status
    private String status; // ACTIVE -> CLOSED -> ENDED
    private Boolean isUnread; // Có tin nhắn chưa �'ọc không?

    // Statistics
    private Integer messageCount; // S�' tin nhắn trong phòng
    private Integer userMessageCount; // S�' tin nhắn từ user
    private Integer mentorMessageCount; // S�' tin nhắn từ mentor

    // Timestamps
    private LocalDateTime createdAt;
    private LocalDateTime lastMessageAt; // Tin nhắn cu�'i cùng lúc nào
    private LocalDateTime closedAt; // Đóng room lúc nào

    // Metadata
    private String topic; // Chủ �'ề tư vấn (VD: "Spring Security 403")
    private Double finalRating; // Rating cu�'i cùng từ user (sau khi �'óng)

}
