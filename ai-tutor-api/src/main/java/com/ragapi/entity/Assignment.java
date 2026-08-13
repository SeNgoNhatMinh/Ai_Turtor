package com.ragapi.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;
import java.util.List;

@Document(collection = "assignments")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Assignment {

    @Id
    private String id;

    private String courseId;
    private String classId;
    private String teacherId;

    private String title;
    private String description;
    /** ASSIGNMENT or EXAM. Teacher-created and manually graded. */
    private String assignmentType;
    private Double maxScore;

    /**
     * ALL_CLASS or SELECTED_STUDENTS.
     */
    private String targetType;
    private List<String> targetStudentIds;

    private String attachmentFileId;
    private String attachmentFileName;
    private String attachmentContentType;
    private Long attachmentFileSize;
    @JsonIgnore private String answerKeyFileId;
    @JsonIgnore private String answerKeyFileName;
    @JsonIgnore private String answerKeyContentType;
    @JsonIgnore private Long answerKeyFileSize;
    private Boolean answerKeyUploaded;

    private LocalDateTime dueAt;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
