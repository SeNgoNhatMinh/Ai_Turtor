package com.ragapi.dto;

import lombok.Data;

@Data
public class LiveLessonAiAskRequest {
    private String question;
    /** Optional playback position such as 12:30 or 750 (seconds). */
    private String videoTimestamp;
}
