package com.ragapi.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Schema(description = "Code mentor request")
public class CodeMentorRequest {

    private String studentId;
    private String courseId;
    private String classId;

    @Schema(description = "Student question about the code or error")
    private String question;

    @Schema(description = "Code snippet or error log")
    private String code;

    @Schema(description = "Programming language or framework", example = "Java Spring Boot")
    private String language;

    @Schema(description = "True if this is related to an assignment/homework")
    private Boolean assignmentRelated;

    private String conversationId;
}
