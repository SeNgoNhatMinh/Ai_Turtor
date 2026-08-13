package com.ragapi.entity;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Document(collection = "course_chapter_outlines")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CourseChapterOutline {
    @Id
    private String id;
    private String courseId;
    /** Stable key for matching Gold Q&A and coverage (slug). */
    private String chapterKey;
    private String title;
    /** SUGGESTED, CONFIRMED, IGNORED */
    private String status;
    /** HEADING, PDF_BOOKMARK, MATERIAL_TITLE, CATEGORY, MANUAL */
    private String detectedFrom;
    @Builder.Default
    private List<String> sourceMaterialIds = new ArrayList<>();
    private Integer tocLevel;
    private Integer pageStart;
    private Integer pageEnd;
    private Integer chunkCount;
    private Long approxChars;
    private String confirmedBy;
    private LocalDateTime confirmedAt;
    private LocalDateTime updatedAt;
}
