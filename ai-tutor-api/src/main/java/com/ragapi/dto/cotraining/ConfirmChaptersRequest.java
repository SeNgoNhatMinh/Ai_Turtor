package com.ragapi.dto.cotraining;

import lombok.Data;

import java.util.List;

@Data
public class ConfirmChaptersRequest {
    private String courseId;
    private String confirmedBy;
    /** chapterKey values senior wants to use for V2 coverage. */
    private List<String> chapterKeys;
}
