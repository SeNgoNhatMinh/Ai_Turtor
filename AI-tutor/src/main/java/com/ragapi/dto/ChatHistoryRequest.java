package com.ragapi.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * ChatHistoryRequest - Request lấy l�<ch sử chat
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ChatHistoryRequest {
    private String chatRoomId;
    private Integer pageNumber;
    private Integer pageSize; // S�' tin nhắn m�-i trang (VD: 50)
}
