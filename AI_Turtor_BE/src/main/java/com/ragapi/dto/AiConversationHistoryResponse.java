package com.ragapi.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AiConversationHistoryResponse {

    private String conversationId;
    private String title;
    private Integer totalMessageCount;
    private Integer pageNumber;
    private Integer pageSize;
    private List<AiMessageInfo> messages;
}





