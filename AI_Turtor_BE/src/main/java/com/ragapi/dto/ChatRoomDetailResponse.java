package com.ragapi.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 * ChatRoomDetailResponse - Response thông tin phòng chat
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ChatRoomDetailResponse {
    private String chatRoomId;
    private String userId;
    private String userName;
    private String mentorId;
    private String mentorName;
    private String mentorEmail;
    private String mentorAvatarUrl;
    private String originalQuestion;
    private String aiResponse;
    private String status;
    private Integer messageCount;
    private LocalDateTime createdAt;
    private LocalDateTime lastMessageAt;
    private Boolean isUnread;
}






