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

/**
 * Structured learning guide extracted from the official syllabus exactly once
 * (when the syllabus is saved or a regeneration is requested), validated
 * against the source text, then stored. Reading a course never calls an LLM:
 * students only see the latest APPROVED guide, or a deterministic parse of
 * the syllabus while no approved guide exists.
 */
@Document(collection = "course_learning_guides")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CourseLearningGuide {

    public static final String STATUS_APPROVED = "APPROVED";
    public static final String STATUS_PENDING_REVIEW = "PENDING_REVIEW";
    public static final String STATUS_REJECTED = "REJECTED";
    public static final String STATUS_FAILED = "FAILED";

    @Id
    private String id;
    private String courseId;
    /** SHA-256 of the syllabus source this guide was extracted from. */
    private String syllabusHash;
    /** Short, human-visible version marker derived from the hash. */
    private String syllabusVersion;
    private String overview;
    @Builder.Default
    private List<String> knowledgeObjectives = new ArrayList<>();
    @Builder.Default
    private List<String> skillObjectives = new ArrayList<>();
    @Builder.Default
    private List<Topic> topics = new ArrayList<>();
    @Builder.Default
    private List<String> keywords = new ArrayList<>();
    /** APPROVED / PENDING_REVIEW / REJECTED / FAILED */
    private String status;
    @Builder.Default
    private List<String> validationWarnings = new ArrayList<>();
    private String errorMessage;
    private String reviewedBy;
    private LocalDateTime reviewedAt;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class Topic {
        private String title;
        private String detail;
    }
}
