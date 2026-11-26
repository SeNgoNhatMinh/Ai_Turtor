package com.ragapi.entity;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;
import java.util.List;

/** One experience survey answer per account; sending it again replaces the earlier answer. */
@Document(collection = "experience_feedback")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ExperienceFeedback {

    /** The respondent's user id. */
    @Id
    private String userId;

    private String email;
    private String fullName;
    private String role;
    private String courseId;
    private String classId;

    /** 1–5 ratings. */
    private Integer overall;
    private Integer aiQuality;
    private Integer speed;
    private Integer easeOfUse;

    /** 0–10 likelihood to recommend. */
    private Integer recommend;

    /** COMPUTER, PHONE or TABLET. */
    private String device;
    /** Any of CHAT, LESSONS, QUIZ, MATERIALS, TEACHER_SUPPORT. */
    private List<String> featuresUsed;

    private Boolean hadIssues;
    private String issueDetail;
    private String liked;
    private String improve;

    private Instant createdAt;
    private Instant updatedAt;
}
