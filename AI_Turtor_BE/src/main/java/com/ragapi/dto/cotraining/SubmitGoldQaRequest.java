package com.ragapi.dto.cotraining;

import lombok.Data;

@Data
public class SubmitGoldQaRequest {
    private String courseId;
    private String chapter;
    private String question;
    private String goldAnswer;
    private String difficulty;
    private String usage;
    private String authorId;
    private String sourceTaskId;
    private String rubricId;
    /** When set, update this Gold Q&A; otherwise create a new one for the task. */
    private String goldQaId;
}
