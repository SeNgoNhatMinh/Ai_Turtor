package com.ragapi.entity;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

/**
 * CaseMemory - Luu tru bo nho theo tung course interaction.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "case_memories")
public class CaseMemory {
    @Id
    private String id;

    private String userId;
    private String caseId; // questionEscalationId hoac chatRoomId

    private String title;
    private String summary;
    private String status;

    @Builder.Default
    private List<String> tags = new ArrayList<>();

    @Builder.Default
    private List<String> requiredDocuments = new ArrayList<>();

    @Builder.Default
    private List<String> knownIssues = new ArrayList<>();

    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}






