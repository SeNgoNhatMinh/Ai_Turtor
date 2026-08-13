package com.ragapi.service;

import com.ragapi.dto.ReviewAssignmentSubmissionRequest;
import com.ragapi.dto.UpdateStudentCourseMemoryRequest;
import com.ragapi.entity.Assignment;
import com.ragapi.entity.AssignmentSubmission;
import com.ragapi.entity.ClassSection;
import com.ragapi.repository.AssignmentRepository;
import com.ragapi.repository.AssignmentSubmissionRepository;
import com.ragapi.repository.ClassSectionRepository;
import com.ragapi.repository.CourseEnrollmentRepository;
import com.ragapi.repository.MentorRepository;
import lombok.AllArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

import static com.ragapi.util.ValidationUtils.DEFAULT_TEXT_MAX_LENGTH;
import static com.ragapi.util.ValidationUtils.SHORT_TEXT_MAX_LENGTH;
import static com.ragapi.util.ValidationUtils.optionalMaxLength;
import static com.ragapi.util.ValidationUtils.requireMaxLength;
import static com.ragapi.util.ValidationUtils.requireText;
import static com.ragapi.util.ValidationUtils.validateScore;

@Service
@AllArgsConstructor
public class AssignmentService {

    private static final String TARGET_ALL_CLASS = "ALL_CLASS";
    private static final String TARGET_SELECTED_STUDENTS = "SELECTED_STUDENTS";

    private final AssignmentRepository assignmentRepository;
    private final AssignmentSubmissionRepository submissionRepository;
    private final ClassSectionRepository classSectionRepository;
    private final CourseEnrollmentRepository enrollmentRepository;
    private final AssignmentFileStorageService fileStorageService;
    private final StudentCourseMemoryService memoryService;
    private final RealtimeEventService realtimeEvents;
    private final MentorRepository mentorRepository;

    public Assignment createAssignment(
            String courseId,
            String classId,
            String teacherId,
            String title,
            String description,
            String assignmentType,
            Double maxScore,
            String targetType,
            String targetStudentIdsCsv,
            LocalDateTime dueAt,
            MultipartFile file
    ) throws IOException {
        String safeCourseId = requireText(courseId, "courseId");
        String safeClassId = requireText(classId, "classId");
        String safeTeacherId = requireText(teacherId, "teacherId");
        String safeTitle = requireMaxLength(title, "title", SHORT_TEXT_MAX_LENGTH);
        optionalMaxLength(description, "description", DEFAULT_TEXT_MAX_LENGTH);
        validateDueAt(dueAt);
        String safeAssignmentType = normalizeAssignmentType(assignmentType);
        double safeMaxScore = maxScore == null ? 10.0 : maxScore;
        if (safeMaxScore <= 0 || safeMaxScore > 1000) throw new IllegalArgumentException("maxScore must be greater than 0 and at most 1000");
        validateTeacherOwnsClass(safeCourseId, safeClassId, safeTeacherId);

        String normalizedTargetType = normalizeTargetType(targetType);
        List<String> targetStudentIds = parseCsv(targetStudentIdsCsv);
        if (TARGET_SELECTED_STUDENTS.equals(normalizedTargetType) && targetStudentIds.isEmpty()) {
            throw new IllegalArgumentException("targetStudentIds is required when targetType is SELECTED_STUDENTS");
        }
        validateTargetStudentsBelongToClass(targetStudentIds, safeCourseId, safeClassId);

        String assignmentId = UUID.randomUUID().toString();
        String fileId = fileStorageService.storeAssignmentFile(file, assignmentId);
        LocalDateTime now = LocalDateTime.now();

        Assignment assignment = Assignment.builder()
                .id(assignmentId)
                .courseId(safeCourseId)
                .classId(safeClassId)
                .teacherId(safeTeacherId)
                .title(safeTitle)
                .description(optionalMaxLength(description, "description", DEFAULT_TEXT_MAX_LENGTH))
                .assignmentType(safeAssignmentType)
                .maxScore(safeMaxScore)
                .targetType(normalizedTargetType)
                .targetStudentIds(targetStudentIds)
                .attachmentFileId(fileId)
                .attachmentFileName(file.getOriginalFilename())
                .attachmentContentType(file.getContentType())
                .attachmentFileSize(file.getSize())
                .dueAt(dueAt)
                .createdAt(now)
                .updatedAt(now)
                .build();

        Assignment saved = assignmentRepository.save(assignment);
        List<String> recipients = TARGET_SELECTED_STUDENTS.equals(normalizedTargetType)
                ? targetStudentIds
                : enrollmentRepository.findByCourseIdAndClassId(safeCourseId, safeClassId).stream()
                        .map(item -> item.getStudentId()).filter(id -> id != null && !id.isBlank()).distinct().toList();
        realtimeEvents.publishToUsers(recipients, "ASSIGNMENT_ASSIGNED", "ASSIGNMENT", saved.getId(), "ASSIGNED", Map.of(
                "courseId", safeCourseId, "classId", safeClassId, "title", safeTitle));
        return saved;
    }

    public List<Assignment> listAssignmentsForClass(String courseId, String classId, String teacherId) {
        validateTeacherOwnsClass(courseId, classId, teacherId);
        return assignmentRepository.findByCourseIdAndClassIdAndTeacherId(courseId, classId, teacherId);
    }

    public List<Assignment> listAssignmentsForStudent(String studentId, String courseId) {
        requireText(studentId, "studentId");

        return assignmentRepository.findAll().stream()
                .filter(assignment -> courseId == null || courseId.isBlank() || courseId.equals(assignment.getCourseId()))
                .filter(assignment -> isStudentTargeted(assignment, studentId))
                .collect(Collectors.toList());
    }

    public AssignmentSubmission submitAssignment(
            String assignmentId,
            String studentId,
            String studentName,
            String studentEmail,
            String note,
            MultipartFile file
    ) throws IOException {
        String safeAssignmentId = requireText(assignmentId, "assignmentId");
        String safeStudentId = requireText(studentId, "studentId");
        optionalMaxLength(note, "note", DEFAULT_TEXT_MAX_LENGTH);

        Assignment assignment = assignmentRepository.findById(safeAssignmentId)
                .orElseThrow(() -> new IllegalArgumentException("Assignment not found"));

        if (!isStudentTargeted(assignment, safeStudentId)) {
            throw new IllegalArgumentException("Student is not targeted for this assignment");
        }

        AssignmentSubmission submission = submissionRepository
                .findByAssignmentIdAndStudentId(safeAssignmentId, safeStudentId)
                .orElseGet(() -> AssignmentSubmission.builder()
                        .id(UUID.randomUUID().toString())
                        .assignmentId(safeAssignmentId)
                        .courseId(assignment.getCourseId())
                        .classId(assignment.getClassId())
                        .teacherId(assignment.getTeacherId())
                        .studentId(safeStudentId)
                        .build());

        String fileId = fileStorageService.storeSubmissionFile(file, safeAssignmentId, submission.getId());
        LocalDateTime now = LocalDateTime.now();

        submission.setStudentName(optionalMaxLength(studentName, "studentName", SHORT_TEXT_MAX_LENGTH));
        submission.setStudentEmail(optionalMaxLength(studentEmail, "studentEmail", SHORT_TEXT_MAX_LENGTH));
        submission.setNote(optionalMaxLength(note, "note", DEFAULT_TEXT_MAX_LENGTH));
        submission.setSubmittedFileId(fileId);
        submission.setSubmittedFileName(file.getOriginalFilename());
        submission.setSubmittedContentType(file.getContentType());
        submission.setSubmittedFileSize(file.getSize());
        submission.setStatus("SUBMITTED");
        submission.setSubmittedAt(now);
        submission.setUpdatedAt(now);

        AssignmentSubmission saved = submissionRepository.save(submission);
        realtimeEvents.publishToUser(assignment.getTeacherId(), "ASSIGNMENT_SUBMITTED", "ASSIGNMENT_SUBMISSION",
                saved.getId(), "SUBMITTED", Map.of(
                        "assignmentId", safeAssignmentId,
                        "studentId", safeStudentId,
                        "fileName", saved.getSubmittedFileName() == null ? "" : saved.getSubmittedFileName()));
        return saved;
    }

    public AssignmentSubmission reviewSubmission(String submissionId, ReviewAssignmentSubmissionRequest request) {
        if (request == null) {
            throw new IllegalArgumentException("request body is required");
        }
        requireText(submissionId, "submissionId");
        requireText(request.getTeacherId(), "teacherId");
        optionalMaxLength(request.getTeacherFeedback(), "teacherFeedback", DEFAULT_TEXT_MAX_LENGTH);

        AssignmentSubmission submission = submissionRepository.findById(submissionId)
                .orElseThrow(() -> new IllegalArgumentException("Submission not found"));

        Assignment assignment = assignmentRepository.findById(submission.getAssignmentId())
                .orElseThrow(() -> new IllegalArgumentException("Assignment not found"));
        validateScore(request.getScore(), 0.0, assignment.getMaxScore() == null ? 10.0 : assignment.getMaxScore());

        if (!request.getTeacherId().trim().equals(submission.getTeacherId())) {
            throw new IllegalArgumentException("Only the class teacher can review this submission");
        }

        submission.setScore(request.getScore());
        submission.setTeacherFeedback(trimToNull(request.getTeacherFeedback()));
        submission.setWeakTopics(cleanList(request.getWeakTopics()));
        submission.setStatus("REVIEWED");
        submission.setReviewedAt(LocalDateTime.now());
        submission.setUpdatedAt(LocalDateTime.now());

        AssignmentSubmission saved = submissionRepository.save(submission);
        updateStudentMemoryFromReview(saved);
        realtimeEvents.publishToUser(saved.getStudentId(), "ASSIGNMENT_REVIEWED", "ASSIGNMENT_SUBMISSION",
                saved.getId(), "REVIEWED", Map.of(
                        "assignmentId", saved.getAssignmentId(),
                        "score", saved.getScore(),
                        "teacherFeedback", saved.getTeacherFeedback() == null ? "" : saved.getTeacherFeedback()));
        return saved;
    }

    public Assignment updateAssignment(String assignmentId, Assignment request) {
        if (request == null) {
            throw new IllegalArgumentException("request body is required");
        }
        String safeAssignmentId = requireText(assignmentId, "assignmentId");
        String safeTeacherId = requireText(request.getTeacherId(), "teacherId");

        Assignment assignment = assignmentRepository.findById(safeAssignmentId)
                .orElseThrow(() -> new IllegalArgumentException("Assignment not found"));
        if (!safeTeacherId.equals(assignment.getTeacherId())) {
            throw new IllegalArgumentException("Only the class teacher can update this assignment");
        }
        if (!submissionRepository.findByAssignmentId(safeAssignmentId).isEmpty()) {
            throw new IllegalArgumentException("Cannot update assignment because submissions already exist");
        }


        if (request.getTitle() != null) {
            assignment.setTitle(requireMaxLength(request.getTitle(), "title", SHORT_TEXT_MAX_LENGTH));
        }
        if (request.getDescription() != null) {
            assignment.setDescription(optionalMaxLength(request.getDescription(), "description", DEFAULT_TEXT_MAX_LENGTH));
        }
        if (request.getDueAt() != null) {
            validateDueAt(request.getDueAt());
            assignment.setDueAt(request.getDueAt());
        }
        if (request.getTargetType() != null) {
            String normalizedTargetType = normalizeTargetType(request.getTargetType());
            List<String> targetStudentIds = request.getTargetStudentIds() == null
                    ? new ArrayList<>()
                    : request.getTargetStudentIds().stream()
                    .filter(value -> value != null && !value.isBlank())
                    .map(String::trim)
                    .distinct()
                    .collect(Collectors.toList());
            if (TARGET_SELECTED_STUDENTS.equals(normalizedTargetType) && targetStudentIds.isEmpty()) {
                throw new IllegalArgumentException("targetStudentIds is required when targetType is SELECTED_STUDENTS");
            }
            validateTargetStudentsBelongToClass(targetStudentIds, assignment.getCourseId(), assignment.getClassId());
            assignment.setTargetType(normalizedTargetType);
            assignment.setTargetStudentIds(targetStudentIds);
        }
        assignment.setUpdatedAt(LocalDateTime.now());
        return assignmentRepository.save(assignment);
    }

    public void deleteAssignment(String assignmentId, String teacherId) {
        String safeAssignmentId = requireText(assignmentId, "assignmentId");
        String safeTeacherId = requireText(teacherId, "teacherId");
        Assignment assignment = assignmentRepository.findById(safeAssignmentId)
                .orElseThrow(() -> new IllegalArgumentException("Assignment not found"));
        if (!safeTeacherId.equals(assignment.getTeacherId())) {
            throw new IllegalArgumentException("Only the class teacher can delete this assignment");
        }
        List<AssignmentSubmission> submissions = submissionRepository.findByAssignmentId(safeAssignmentId);
        if (!submissions.isEmpty()) {
            throw new IllegalArgumentException("Cannot delete assignment because submissions already exist");
        }
        assignmentRepository.delete(assignment);
    }
    public List<AssignmentSubmission> listSubmissions(String assignmentId, String teacherId) {
        String safeAssignmentId = requireText(assignmentId, "assignmentId");
        String safeTeacherId = requireText(teacherId, "teacherId");
        Assignment assignment = assignmentRepository.findById(safeAssignmentId)
                .orElseThrow(() -> new IllegalArgumentException("Assignment not found"));

        if (!assignment.getTeacherId().equals(safeTeacherId)) {
            throw new IllegalArgumentException("Only the class teacher can view submissions");
        }

        return submissionRepository.findByAssignmentId(safeAssignmentId);
    }

    public List<AssignmentSubmission> listSubmissionsForStudent(String studentId, String courseId) {
        requireText(studentId, "studentId");
        return submissionRepository.findByStudentId(studentId).stream()
                .filter(submission -> courseId == null || courseId.isBlank() || courseId.equals(submission.getCourseId()))
                .collect(Collectors.toList());
    }

    public List<AssignmentSubmission> listSubmissionsForClass(String courseId, String classId, String teacherId) {
        validateTeacherOwnsClass(courseId, classId, teacherId);
        return submissionRepository.findByCourseIdAndClassId(courseId, classId);
    }

    public Assignment getAssignment(String assignmentId) {
        return assignmentRepository.findById(assignmentId)
                .orElseThrow(() -> new IllegalArgumentException("Assignment not found"));
    }

    public AssignmentSubmission getSubmission(String submissionId) {
        return submissionRepository.findById(submissionId)
                .orElseThrow(() -> new IllegalArgumentException("Submission not found"));
    }

    private void validateTargetStudentsBelongToClass(List<String> targetStudentIds, String courseId, String classId) {
        for (String studentId : targetStudentIds) {
            if (enrollmentRepository.findByStudentIdAndCourseIdAndClassId(studentId, courseId, classId).isEmpty()) {
                throw new IllegalArgumentException("targetStudentIds contains a student not enrolled in this class: " + studentId);
            }
        }
    }

    private void validateDueAt(LocalDateTime dueAt) {
        if (dueAt != null && dueAt.isBefore(LocalDateTime.now())) {
            throw new IllegalArgumentException("dueAt must not be in the past");
        }
    }

    private void validateTeacherOwnsClass(String courseId, String classId, String teacherId) {
        requireText(courseId, "courseId");
        requireText(classId, "classId");
        requireText(teacherId, "teacherId");

        ClassSection section = classSectionRepository.findByCourseIdAndClassId(courseId.trim(), classId.trim())
                .orElseThrow(() -> new IllegalArgumentException("Class section not found"));

        String requestedTeacher = teacherId.trim();
        String sectionTeacher = section.getTeacherId();
        boolean sameTeacher = requestedTeacher.equals(sectionTeacher)
                || mentorRepository.findById(requestedTeacher)
                .map(mentor -> sectionTeacher.equalsIgnoreCase(mentor.getMentorCode())
                        || sectionTeacher.equals(mentor.getId()))
                .orElse(false);
        if (!sameTeacher) {
            throw new IllegalArgumentException("Teacher does not own this class section");
        }
    }

    private boolean isStudentTargeted(Assignment assignment, String studentId) {
        if (assignment == null || studentId == null || studentId.isBlank()) {
            return false;
        }

        if (TARGET_SELECTED_STUDENTS.equalsIgnoreCase(assignment.getTargetType())) {
            return assignment.getTargetStudentIds() != null
                    && assignment.getTargetStudentIds().stream().anyMatch(studentId::equals);
        }

        return enrollmentRepository
                .findByStudentIdAndCourseIdAndClassId(studentId, assignment.getCourseId(), assignment.getClassId())
                .isPresent();
    }

    private void updateStudentMemoryFromReview(AssignmentSubmission submission) {
        UpdateStudentCourseMemoryRequest memoryRequest = new UpdateStudentCourseMemoryRequest();
        memoryRequest.setClassId(submission.getClassId());
        memoryRequest.setWeakTopics(submission.getWeakTopics());

        List<String> suggestions = new ArrayList<>();
        if (submission.getScore() != null) {
            suggestions.add("Assignment score: " + submission.getScore());
        }
        if (submission.getTeacherFeedback() != null && !submission.getTeacherFeedback().isBlank()) {
            suggestions.add("Teacher feedback: " + submission.getTeacherFeedback().trim());
        }
        memoryRequest.setImproveSuggestions(suggestions);

        memoryService.updateMemory(submission.getStudentId(), submission.getCourseId(), memoryRequest);
    }

    private String normalizeTargetType(String targetType) {
        if (targetType == null || targetType.isBlank()) {
            return TARGET_ALL_CLASS;
        }
        String normalized = targetType.trim().toUpperCase();
        if (!TARGET_ALL_CLASS.equals(normalized) && !TARGET_SELECTED_STUDENTS.equals(normalized)) {
            throw new IllegalArgumentException("targetType must be ALL_CLASS or SELECTED_STUDENTS");
        }
        return normalized;
    }

    private String normalizeAssignmentType(String value) {
        String normalized = value == null || value.isBlank() ? "ASSIGNMENT" : value.trim().toUpperCase();
        if (!"ASSIGNMENT".equals(normalized) && !"EXAM".equals(normalized)) {
            throw new IllegalArgumentException("assignmentType must be ASSIGNMENT or EXAM");
        }
        return normalized;
    }

    private List<String> parseCsv(String csv) {
        if (csv == null || csv.isBlank()) {
            return new ArrayList<>();
        }
        return Arrays.stream(csv.split(","))
                .map(String::trim)
                .filter(value -> !value.isBlank())
                .distinct()
                .collect(Collectors.toList());
    }

    private List<String> cleanList(List<String> values) {
        if (values == null) {
            return new ArrayList<>();
        }
        return values.stream()
                .filter(value -> value != null && !value.isBlank())
                .map(String::trim)
                .distinct()
                .collect(Collectors.toList());
    }

    private String trimToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }
}
