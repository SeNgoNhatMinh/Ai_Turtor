package com.ragapi.entity;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;

@Document(collection = "live_lessons")
@CompoundIndex(name = "live_lesson_class_start_idx", def = "{'courseId': 1, 'classId': 1, 'startsAt': -1}")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class LiveLesson {

    @Id
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

    /** SCHEDULED, LIVE, or ENDED. LIVE only after the teacher starts playback. */
    private String status;

    private LocalDateTime startsAt;
    private LocalDateTime endsAt;
    /** Set when the teacher presses play; students cannot start the video themselves. */
    private LocalDateTime playbackStartedAt;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
