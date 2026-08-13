package com.ragapi.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 * ChatClosureResponse - Response �'óng phòng
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ChatClosureResponse {
    private String chatRoomId;
    private String status;
    private String message;
    private LocalDateTime closedAt;
    private String questionEscalationId;
    private Boolean canCreateKnowledgeCandidate;
    private String suggestedCandidateType;
    private String nextAction;
}
