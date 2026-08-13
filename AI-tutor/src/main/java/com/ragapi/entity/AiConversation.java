package com.ragapi.entity;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;

/**
 * AiConversation - M�Tt cu�Tc h�Ti thoại AI (sidebar ki�fu ChatGPT).
 */
@Document(collection = "ai_conversations")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AiConversation {

    @Id
    private String id;

    private String userId;

    private String courseId;

    private String classId;

    /** Tiêu �'ề hi�fn th�< trên sidebar (thường lấy từ câu hỏi �'ầu tiên). */
    private String title;

    private Integer messageCount;

    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    private LocalDateTime lastMessageAt;
}
