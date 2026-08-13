package com.ragapi.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * ChatRoomDetailRequest - Request lấy thông tin chi tiết phòng chat
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ChatRoomDetailRequest {
    private String chatRoomId;
}






