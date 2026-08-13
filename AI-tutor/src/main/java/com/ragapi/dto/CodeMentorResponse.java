package com.ragapi.dto;

import com.ragapi.util.TextSanitizer;
import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@NoArgsConstructor
@Schema(description = "Code mentor response")
public class CodeMentorResponse {
    private String answer;
    private String mode;
    private Boolean assignmentSafetyApplied;
    private List<String> weakTopics;
    private String conversationId;
    private String groundingType;
    private String sourceDisclosure;

    @Builder
    public CodeMentorResponse(
            String answer,
            String mode,
            Boolean assignmentSafetyApplied,
            List<String> weakTopics,
            String conversationId,
            String groundingType,
            String sourceDisclosure
    ) {
        setAnswer(answer);
        this.mode = mode;
        this.assignmentSafetyApplied = assignmentSafetyApplied;
        setWeakTopics(weakTopics);
        this.conversationId = conversationId;
        this.groundingType = groundingType;
        this.sourceDisclosure = sourceDisclosure;
    }

    public void setAnswer(String answer) {
        this.answer = TextSanitizer.cleanForStudentAnswer(answer);
    }

    public void setWeakTopics(List<String> weakTopics) {
        this.weakTopics = TextSanitizer.cleanList(weakTopics);
    }
}
