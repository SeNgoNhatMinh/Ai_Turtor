package com.ragapi.dto;

import lombok.Data;

import java.time.LocalDateTime;

@Data
public class AssignTeachingBehaviorRequest {
    private String courseId;
    private String classId;
    /** Empty assigns the template to the whole course. */
    private String studentId;
    private String customizedInstructions;
    private Integer priorityOverride;
    private LocalDateTime effectiveFrom;
    private LocalDateTime effectiveUntil;
}
