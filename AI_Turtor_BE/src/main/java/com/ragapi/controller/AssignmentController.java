package com.ragapi.controller;

import com.ragapi.dto.ReviewAssignmentSubmissionRequest;
import com.ragapi.entity.Assignment;
import com.ragapi.entity.AssignmentSubmission;
import com.ragapi.service.AssignmentFileStorageService;
import com.ragapi.service.AssignmentService;
import com.ragapi.service.TeacherAiGradingService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.AllArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.io.Resource;
import org.springframework.data.mongodb.gridfs.GridFsResource;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@Slf4j
@RestController
@RequestMapping("/api")
@AllArgsConstructor
@Tag(name = "Assignments", description = "Teacher assignment distribution and manual review APIs")
public class AssignmentController {

    private final AssignmentService assignmentService;
    private final AssignmentFileStorageService fileStorageService;
    private final TeacherAiGradingService aiGradingService;

    @PostMapping(
            value = "/mentor/courses/{courseId}/classes/{classId}/assignments/upload",
            consumes = MediaType.MULTIPART_FORM_DATA_VALUE
    )
    @Operation(summary = "Teacher uploads an assignment file and sends it to class or selected students")
    public ResponseEntity<?> createAssignment(
            @PathVariable String courseId,
            @PathVariable String classId,
            @RequestParam String teacherId,
            @RequestParam String title,
            @RequestParam(required = false) String description,
            @RequestParam(defaultValue = "ASSIGNMENT") String assignmentType,
            @RequestParam(defaultValue = "10") Double maxScore,
            @RequestParam(defaultValue = "ALL_CLASS") String targetType,
            @RequestParam(required = false) String targetStudentIds,
            @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME)
            LocalDateTime dueAt,
            @Parameter(description = "Assignment file, for example ZIP/PDF/DOCX", required = true, schema = @Schema(type = "string", format = "binary"))
            @RequestPart("file") MultipartFile file
    ) {
        try {
            Assignment assignment = assignmentService.createAssignment(
                    courseId,
                    classId,
                    teacherId,
                    title,
                    description,
                    assignmentType,
                    maxScore,
                    targetType,
                    targetStudentIds,
                    dueAt,
                    file
            );
            return ResponseEntity.ok(assignment);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        } catch (IOException e) {
            log.error("Error storing assignment file", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Cannot store assignment file: " + e.getMessage()));
        }
    }

    @PostMapping(value = "/mentor/assignments/{assignmentId}/answer-key", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @Operation(summary = "Teacher uploads a private answer key for optional AI-assisted grading")
    public ResponseEntity<?> uploadAnswerKey(@PathVariable String assignmentId,
                                             @RequestParam String teacherId,
                                             @RequestPart("file") MultipartFile file) {
        try {
            return ResponseEntity.ok(aiGradingService.uploadAnswerKey(assignmentId, teacherId, file));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        } catch (IOException e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(Map.of("error", e.getMessage()));
        }
    }

    @PostMapping("/mentor/assignment-submissions/{submissionId}/ai-grade")
    @Operation(summary = "Generate an AI score suggestion; teacher still confirms the final score")
    public ResponseEntity<?> aiGradeSubmission(@PathVariable String submissionId, @RequestParam String teacherId) {
        try {
            return ResponseEntity.ok(aiGradingService.grade(submissionId, teacherId));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        } catch (Exception e) {
            log.error("AI-assisted grading failed", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(Map.of("error", e.getMessage()));
        }
    }

    @GetMapping("/mentor/courses/{courseId}/classes/{classId}/assignments")
    @Operation(summary = "Teacher lists assignments for one class")
    public ResponseEntity<?> listClassAssignments(
            @PathVariable String courseId,
            @PathVariable String classId,
            @RequestParam String teacherId
    ) {
        try {
            return ResponseEntity.ok(assignmentService.listAssignmentsForClass(courseId, classId, teacherId));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @GetMapping("/assignments/{assignmentId}")
    @Operation(summary = "Get assignment detail")
    public ResponseEntity<?> getAssignmentDetail(@PathVariable String assignmentId) {
        try {
            return ResponseEntity.ok(assignmentService.getAssignment(assignmentId));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @PutMapping("/mentor/assignments/{assignmentId}")
    @Operation(summary = "Teacher updates assignment metadata before submissions exist")
    public ResponseEntity<?> updateAssignment(
            @PathVariable String assignmentId,
            @RequestBody Assignment request
    ) {
        try {
            return ResponseEntity.ok(assignmentService.updateAssignment(assignmentId, request));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @DeleteMapping("/mentor/assignments/{assignmentId}")
    @Operation(summary = "Teacher deletes an assignment that has no submissions")
    public ResponseEntity<?> deleteAssignment(
            @PathVariable String assignmentId,
            @RequestParam String teacherId
    ) {
        try {
            assignmentService.deleteAssignment(assignmentId, teacherId);
            return ResponseEntity.ok(Map.of("status", "DELETED", "assignmentId", assignmentId));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }
    @GetMapping("/students/{studentId}/assignments")
    @Operation(summary = "Student lists assignments assigned to them")
    public ResponseEntity<List<Assignment>> listStudentAssignments(
            @PathVariable String studentId,
            @RequestParam(required = false) String courseId
    ) {
        return ResponseEntity.ok(assignmentService.listAssignmentsForStudent(studentId, courseId));
    }

    @GetMapping("/students/{studentId}/submissions")
    @Operation(summary = "Student lists their submissions, scores and teacher feedback")
    public ResponseEntity<List<AssignmentSubmission>> listStudentSubmissions(
            @PathVariable String studentId,
            @RequestParam(required = false) String courseId
    ) {
        return ResponseEntity.ok(assignmentService.listSubmissionsForStudent(studentId, courseId));
    }

    @PostMapping(
            value = "/students/assignments/{assignmentId}/submit",
            consumes = MediaType.MULTIPART_FORM_DATA_VALUE
    )
    @Operation(summary = "Student submits an assignment file")
    public ResponseEntity<?> submitAssignment(
            @PathVariable String assignmentId,
            @RequestParam String studentId,
            @RequestParam(required = false) String studentName,
            @RequestParam(required = false) String studentEmail,
            @RequestParam(required = false) String note,
            @Parameter(description = "Student submission file", required = true, schema = @Schema(type = "string", format = "binary"))
            @RequestPart("file") MultipartFile file
    ) {
        try {
            AssignmentSubmission submission = assignmentService.submitAssignment(
                    assignmentId,
                    studentId,
                    studentName,
                    studentEmail,
                    note,
                    file
            );
            return ResponseEntity.ok(submission);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        } catch (IOException e) {
            log.error("Error storing submission file", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Cannot store submission file: " + e.getMessage()));
        }
    }

    @GetMapping("/mentor/assignments/{assignmentId}/submissions")
    @Operation(summary = "Teacher lists submissions for an assignment")
    public ResponseEntity<?> listSubmissions(
            @PathVariable String assignmentId,
            @RequestParam String teacherId
    ) {
        try {
            return ResponseEntity.ok(assignmentService.listSubmissions(assignmentId, teacherId));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @GetMapping("/mentor/courses/{courseId}/classes/{classId}/submissions")
    @Operation(summary = "Teacher lists submissions, scores and feedback for a class")
    public ResponseEntity<?> listClassSubmissions(
            @PathVariable String courseId,
            @PathVariable String classId,
            @RequestParam String teacherId
    ) {
        try {
            return ResponseEntity.ok(assignmentService.listSubmissionsForClass(courseId, classId, teacherId));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @PutMapping("/mentor/submissions/{submissionId}/review")
    @Operation(summary = "Teacher manually reviews a submission and records score/feedback")
    public ResponseEntity<?> reviewSubmission(
            @PathVariable String submissionId,
            @RequestBody ReviewAssignmentSubmissionRequest request
    ) {
        try {
            return ResponseEntity.ok(assignmentService.reviewSubmission(submissionId, request));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @GetMapping("/assignments/{assignmentId}/file")
    @Operation(summary = "Download assignment attachment")
    public ResponseEntity<?> downloadAssignmentFile(@PathVariable String assignmentId) {
        try {
            Assignment assignment = assignmentService.getAssignment(assignmentId);
            GridFsResource resource = fileStorageService.loadByFileId(assignment.getAttachmentFileId());
            return fileResponse(resource, assignment.getAttachmentFileName(), assignment.getAttachmentContentType());
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @GetMapping("/submissions/{submissionId}/file")
    @Operation(summary = "Download student submission file")
    public ResponseEntity<?> downloadSubmissionFile(@PathVariable String submissionId) {
        try {
            AssignmentSubmission submission = assignmentService.getSubmission(submissionId);
            GridFsResource resource = fileStorageService.loadByFileId(submission.getSubmittedFileId());
            return fileResponse(resource, submission.getSubmittedFileName(), submission.getSubmittedContentType());
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    private ResponseEntity<Resource> fileResponse(GridFsResource resource, String fileName, String contentType) {
        MediaType mediaType = safeMediaType(contentType);
        String safeFileName = fileName != null && !fileName.isBlank() ? fileName : "download.bin";

        return ResponseEntity.ok()
                .contentType(mediaType)
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + safeFileName + "\"")
                .body(resource);
    }

    private MediaType safeMediaType(String contentType) {
        if (contentType == null || contentType.isBlank()) {
            return MediaType.APPLICATION_OCTET_STREAM;
        }
        try {
            return MediaType.parseMediaType(contentType);
        } catch (Exception e) {
            return MediaType.APPLICATION_OCTET_STREAM;
        }
    }
}
