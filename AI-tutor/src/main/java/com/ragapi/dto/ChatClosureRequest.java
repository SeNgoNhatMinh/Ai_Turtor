package com.ragapi.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * ChatClosureRequest - Request �'óng phòng chat
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ChatClosureRequest {
    private String chatRoomId;
    private String userId;
    private Double userRating; // 1-5 stars
    private String userFeedback;
}
