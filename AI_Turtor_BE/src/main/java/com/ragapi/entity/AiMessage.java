package com.ragapi.entity;

import com.ragapi.dto.RagSourceEvidence;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;
import java.util.List;

@Document(collection = "ai_messages")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AiMessage {

    @Id
    private String id;

    private String conversationId;
    private String userId;
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
