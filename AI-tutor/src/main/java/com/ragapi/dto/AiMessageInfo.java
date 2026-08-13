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
    private Boolean pinned;
    private LocalDateTime pinnedAt;
    private LocalDateTime createdAt;
}
