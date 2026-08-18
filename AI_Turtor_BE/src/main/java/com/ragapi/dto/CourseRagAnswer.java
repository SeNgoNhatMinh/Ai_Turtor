package com.ragapi.dto;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.ragapi.util.TextSanitizer;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@NoArgsConstructor
public class CourseRagAnswer {
    private String answer;
    private Double confidence;
    private List<String> sources;
    private List<RagSourceEvidence> sourceEvidence;
    private String groundingType;
    private Boolean escalationRecommended;
    private String escalationReason;
    @JsonIgnore
    private TutorCacheHitMetadata cacheHitMetadata;

    @Builder
    public CourseRagAnswer(
            String answer,
            Double confidence,
            List<String> sources,
            List<RagSourceEvidence> sourceEvidence,
            String groundingType,
            Boolean escalationRecommended,
            String escalationReason,
            TutorCacheHitMetadata cacheHitMetadata
    ) {
        setAnswer(answer);
        this.confidence = confidence;
        setSources(sources);
        this.sourceEvidence = sourceEvidence == null ? List.of() : sourceEvidence;
        this.groundingType = groundingType;
        this.escalationRecommended = escalationRecommended;
        setEscalationReason(escalationReason);
        this.cacheHitMetadata = cacheHitMetadata;
    }

    public void setAnswer(String answer) {
        this.answer = TextSanitizer.cleanForStudentAnswer(answer);
    }

    public void setSources(List<String> sources) {
        this.sources = TextSanitizer.cleanList(sources);
    }

    public void setEscalationReason(String escalationReason) {
        this.escalationReason = TextSanitizer.clean(escalationReason);
    }
}
