package com.ragapi.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Schema(description = "AI tutor query request")
public class AiQueryRequest {

    @Schema(description = "Student question. Use either question or message; message has higher priority when both are provided.", example = "Explain MVC in Spring Boot")
    private String question;

    @Schema(description = "Alias of question for chat/n8n clients. Use either message or question; do not send different values in both fields.", example = "JPA l\u00e0 g\u00ec?")
    private String message;

    @Schema(description = "Optional code snippet or error log. When present, intent classifier may route to CODE mode.")
    private String codeSnippet;

    @Schema(description = "Course ID for course-scoped RAG search", example = "PRJ301")
    private String courseId;

    @Schema(description = "Optional class section ID for memory/escalation context. RAG search is currently scoped by courseId.", example = "SE1840")
    private String classId;

    @Schema(description = "Existing conversation ID. Omit this field for the first message; reuse the returned conversationId to continue the chat.", example = "uuid-conversation-id")
    private String conversationId;

    @Schema(description = "Active proactive tutor session ID")
    private String tutorSessionId;

    @Schema(description = "Current tutor phase: OPEN, DIAGNOSTIC, TEACH, PRACTICE or REFLECT")
    private String sessionPhase;

    @Schema(description = "Internal n8n marker: per-course quota was consumed before intent routing", hidden = true)
    private Boolean quotaConsumed;

    @Schema(description = "n8n Switch already chose RAG, CODE, or ESCALATE. Omit when FE calls this API directly.")
    private String harnessMode;
}
