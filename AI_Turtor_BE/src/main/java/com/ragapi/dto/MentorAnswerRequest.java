package com.ragapi.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Schema(description = "Teacher or mentor answer for an escalation")
public class MentorAnswerRequest {

    @Schema(description = "Teacher or mentor ID", example = "TCH001")
    private String teacherId;

    @Schema(description = "Teacher or mentor display name", example = "Teacher A")
    private String teacherName;

    @Schema(description = "Answer sent back to the student")
    private String answer;

    @Schema(description = "True only when this answer contains reusable academic knowledge that may become AI brain knowledge after senior approval")
    private Boolean createKnowledgeCandidate;

    @Schema(description = "ACADEMIC_KNOWLEDGE, MATERIAL_CORRECTION, FAQ_CLARIFICATION, OPERATIONAL_POLICY, GRADING_DECISION, CLASS_RULE, ASSIGNMENT_SPECIFIC", example = "ACADEMIC_KNOWLEDGE")
    private String candidateType;
}