package com.ragapi.dto;

import lombok.Data;

import java.time.LocalDateTime;

@Data
public class CreateLiveLessonRequest {
    private String courseId;
    private String classId;
    private String topic;
    private String youtubeUrl;
    private LocalDateTime startsAt;
    private LocalDateTime endsAt;
}
