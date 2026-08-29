package com.ragapi.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class IntentClassification {
    private String mode;
    private String reason;
    private Double confidence;

    /**
     * More specific learning intent for FE/n8n observability.
     * Examples: CONCEPT_EXPLANATION, CODE_DEBUG, LEARNING_GUIDANCE, TEACHER_POLICY.
     */
    private String subIntent;

    /**
     * Detected technical/study domain, such as OOP, DATABASE, WEB, OS, NETWORK, SECURITY.
     */
    private String domain;

    /**
     * How the AI is allowed to answer this request.
     */
    private String answerPolicy;

    /**
     * True when the answer must be grounded in uploaded course materials.
     */
    private Boolean requiresCourseMaterial;

    /**
     * Decision source used for diagnostics: RULE, LLM, or SAFE_RAG_FALLBACK.
     */
    private String routingStrategy;
}