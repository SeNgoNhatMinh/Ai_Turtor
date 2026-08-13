package com.ragapi.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * ChatHistoryResponse - Response l�<ch sử chat
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ChatHistoryResponse {
    private String chatRoomId;
    private Integer totalMessageCount;
    private Integer pageNumber;
    private Integer pageSize;
    private List<ChatMessageInfo> messages;
}
