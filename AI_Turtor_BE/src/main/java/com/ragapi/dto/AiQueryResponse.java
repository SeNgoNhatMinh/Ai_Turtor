package com.ragapi.dto;

import com.ragapi.util.TextSanitizer;
import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Schema(description = "AI query response")
public class AiQueryResponse {

    @Schema(description = "Selected AI mode: RAG, CODE, or ESCALATE")
    private String mode;

    @Schema(description = "Intent classifier reason")
    private String intentReason;

    @Schema(description = "Intent classifier confidence", example = "0.95")
    private Double intentConfidence;

    @Schema(description = "Specific learning intent, for example EXPLAIN_CONCEPT, DEBUG_CODE, GUIDE_SOLUTION")
    private String subIntent;

    @Schema(description = "Detected study/technical domain, for example OOP, WEB, DATABASE")
    private String domain;

    @Schema(description = "Answer policy selected by the classifier")
    private String answerPolicy;

    @Schema(description = "Whether the answer must be grounded in course material")
    private Boolean requiresCourseMaterial;

    @Schema(description = "AI-generated answer")
    private String answer;

    @Schema(description = "Estimated answer confidence from retrieval quality", example = "0.85")
    private Double confidence;

    @Schema(description = "Whether the question was escalated to a teacher or mentor")
    private Boolean escalated;

    @Schema(description = "Reason for escalation when escalated is true")
    private String escalationReason;

    @Schema(description = "Conversation ID used for chat history")
    private String conversationId;

    @Schema(description = "User message ID saved in conversation history")
    private String userMessageId;

    @Schema(description = "Assistant message ID saved in conversation history")
    private String assistantMessageId;

    @Schema(description = "Course ID scoped to this conversation")
    private String courseId;

    @Schema(description = "Question escalation ID when teacher help is required")
    private String questionEscalationId;

    @Schema(description = "Suggestion text or key that was clicked to continue learning")
    private String clickedSuggestion;

    @Schema(description = "Whether the clicked suggestion has been consumed by this chat turn")
    private Boolean suggestionConsumed;

    @Schema(description = "Next improve suggestions after this answer")
    private List<SuggestionItem> nextImproveSuggestions;

    @Schema(description = "Optional AI-generated improve plan as raw text or JSON")
    private String nextAiSuggestion;

    @Schema(description = "Source material labels used by the AI answer")
    private List<String> sources;

    @Schema(description = "Structured proof: course, material, chapter, page range and excerpt used by RAG")
    private List<RagSourceEvidence> sourceEvidence;

    @Schema(description = "COURSE_MATERIAL, AI_GENERAL_KNOWLEDGE, MEMORY, or NONE")
    private String groundingType;

    public void setAnswer(String answer) {
        this.answer = TextSanitizer.cleanForStudentAnswer(answer);
    }

    public void setIntentReason(String intentReason) {
        this.intentReason = TextSanitizer.clean(intentReason);
    }

    public void setEscalationReason(String escalationReason) {
        this.escalationReason = TextSanitizer.clean(escalationReason);
    }

    public void setSubIntent(String subIntent) {
        this.subIntent = TextSanitizer.clean(subIntent);
    }

    public void setDomain(String domain) {
        this.domain = TextSanitizer.clean(domain);
    }

    public void setAnswerPolicy(String answerPolicy) {
        this.answerPolicy = TextSanitizer.clean(answerPolicy);
    }

    public void setClickedSuggestion(String clickedSuggestion) {
        this.clickedSuggestion = TextSanitizer.clean(clickedSuggestion);
    }

    public void setNextAiSuggestion(String nextAiSuggestion) {
        this.nextAiSuggestion = TextSanitizer.cleanForStudentAnswer(nextAiSuggestion);
    }

    public void setSources(List<String> sources) {
        this.sources = TextSanitizer.cleanList(sources);
    }
}
