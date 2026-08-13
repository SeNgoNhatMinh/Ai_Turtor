package com.ragapi.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * ChatMarkAsReadRequest - Request �'ánh dấu �'ã �'ọc
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ChatMarkAsReadRequest {
    private String chatRoomId;
    private String userId;
}
