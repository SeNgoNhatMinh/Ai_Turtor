package com.ragapi.dto.cotraining;

import lombok.Data;

@Data
public class ManualChapterRequest {
    private String courseId;
    private String title;
    private String createdBy;
    /** When true, mark the new chapter as CONFIRMED immediately. */
    private Boolean confirmImmediately;
}
