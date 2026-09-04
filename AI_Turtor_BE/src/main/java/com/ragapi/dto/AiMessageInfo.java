package com.ragapi.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AiMessageInfo {

    private String messageId;
    private String role;
    private String content;
    private String mode;
    private Double confidence;
    private List<String> sources;
    private List<RagSourceEvidence> sourceEvidence;
    private String groundingType;
    private String questionEscalationId;
    private String tutorSessionId;
    private String sessionPhase;
    private Boolean proactive;
    private Boolean pinned;
    private LocalDateTime pinnedAt;
    private String understandingSelectedKey;
    private LocalDateTime understandingAnsweredAt;
    private LocalDateTime createdAt;
}





