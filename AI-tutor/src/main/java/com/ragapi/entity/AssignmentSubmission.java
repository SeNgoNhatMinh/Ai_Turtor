package com.ragapi.entity;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;
import java.util.List;

@Document(collection = "assignment_submissions")
@CompoundIndex(name = "assignment_student_unique_idx", def = "{'assignmentId': 1, 'studentId': 1}", unique = true)
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AssignmentSubmission {

    @Id
    private String id;

    private String assignmentId;
    private String courseId;
    private String classId;
    private String teacherId;

    private String studentId;
    private String studentName;
    private String studentEmail;
    private String note;

    private String submittedFileId;
    private String submittedFileName;
    private String submittedContentType;
    private Long submittedFileSize;

    /**
     * SUBMITTED or REVIEWED.
     */
    private String status;

    private Double score;
    private String teacherFeedback;
    private List<String> weakTopics;
    private String aiGradingStatus;
    private Double aiSuggestedScore;
    private String aiFeedback;
    private String aiGradingRaw;
    private LocalDateTime aiGradedAt;

    private LocalDateTime submittedAt;
    private LocalDateTime reviewedAt;
    private LocalDateTime updatedAt;
}
