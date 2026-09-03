package com.ragapi.dto;

import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@Builder
public class LiveLessonResponse {
    private String id;
    private String courseId;
    private String courseName;
    private String classId;
    private String className;
    private String teacherId;
    private String teacherName;
    private String topic;
    private String youtubeUrl;
    private String youtubeVideoId;
    private String embedUrl;
    private String status;
    private LocalDateTime startsAt;
    private LocalDateTime endsAt;
    private LocalDateTime playbackStartedAt;
    private boolean playbackActive;
    private int playbackElapsedSeconds;
    /** True from 10 minutes before startsAt until the teacher starts the video. */
    private boolean upcomingSoon;
    private long minutesUntilStart;
}
