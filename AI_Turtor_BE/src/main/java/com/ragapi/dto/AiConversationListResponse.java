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
public class AiConversationListResponse {

    private String userId;
    private Integer totalCount;
    private Integer pageNumber;
    private Integer pageSize;
    private List<AiConversationSummary> conversations;
}





