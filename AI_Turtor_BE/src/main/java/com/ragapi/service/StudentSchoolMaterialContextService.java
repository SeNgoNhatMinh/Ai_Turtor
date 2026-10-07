package com.ragapi.service;

import com.ragapi.dto.StudentSchoolExcerpt;
import com.ragapi.entity.CourseEnrollment;
import com.ragapi.repository.CourseEnrollmentRepository;
import com.ragapi.service.course.model.RetrievedCourseChunk;
import com.ragapi.service.course.search.CourseContextRetrievalService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.regex.Pattern;

/**
 * Retrieves the school's indexed course material for one student question.
 * The result is safe to show a student's own LLM: passage text and a chapter
 * title only.
 */
@Service
@RequiredArgsConstructor
public class StudentSchoolMaterialContextService {

    static final int MAX_EXCERPTS = 6;
    static final int MAX_CHARS = 8_000;

    private static final Pattern SECRET_MATERIAL = Pattern.compile(
            "(?i)(sk-or-|sk-[a-z0-9]{10,}|nvapi-|mongodb\\+srv://|AKIA[0-9A-Z]{16}|BEGIN [A-Z ]*PRIVATE KEY)"
    );
    private static final Set<String> CLOSED_ENROLLMENT = Set.of(
            "DROPPED", "WITHDRAWN", "INACTIVE", "CANCELLED"
    );

    private final CourseEnrollmentRepository enrollmentRepository;
    private final CourseContextRetrievalService retrievalService;

    public void requireOpenEnrollment(String studentId, String courseId) {
        String safeStudentId = required(studentId, "studentId");
        String safeCourseId = required(courseId, "courseId");
        boolean enrolled = enrollmentRepository.findByStudentId(safeStudentId).stream()
                .anyMatch(enrollment -> matchesCourse(enrollment, safeCourseId));
        if (!enrolled) {
            throw new SchoolMaterialAccessException("Student is not enrolled in this course");
        }
    }

    public List<StudentSchoolExcerpt> excerptsFor(String studentId, String courseId, String classId, String question) {
        requireOpenEnrollment(studentId, courseId);
        var retrieved = retrievalService.retrieve(
                question,
                courseId.trim(),
                classId,
                false,
                null,
                null,
                List.of()
        );
        return project(retrieved.chunks());
    }

    static List<StudentSchoolExcerpt> project(List<RetrievedCourseChunk> chunks) {
        if (chunks == null || chunks.isEmpty()) {
            return List.of();
        }
        List<StudentSchoolExcerpt> excerpts = new ArrayList<>();
        int used = 0;
        for (RetrievedCourseChunk chunk : chunks) {
            if (excerpts.size() >= MAX_EXCERPTS || used >= MAX_CHARS) {
                break;
            }
            String text = chunk == null || chunk.content() == null ? "" : chunk.content().trim();
            if (text.isBlank() || SECRET_MATERIAL.matcher(text).find()) {
                continue;
            }
            int room = MAX_CHARS - used;
            if (text.length() > room) {
                text = text.substring(0, room).trim();
            }
            if (text.isBlank()) {
                continue;
            }
            excerpts.add(new StudentSchoolExcerpt(visibleTitle(chunk), text));
            used += text.length();
        }
        return List.copyOf(excerpts);
    }

    private static String visibleTitle(RetrievedCourseChunk chunk) {
        String title = firstText(chunk.chapterTitle(), chunk.sectionTitle());
        if (title.equalsIgnoreCase("document")) {
            return "";
        }
        return title;
    }

    private static String firstText(String primary, String fallback) {
        if (primary != null && !primary.isBlank()) {
            return primary.trim();
        }
        return fallback == null ? "" : fallback.trim();
    }

    private static boolean matchesCourse(CourseEnrollment enrollment, String courseId) {
        if (enrollment == null || enrollment.getCourseId() == null) {
            return false;
        }
        if (!enrollment.getCourseId().trim().equalsIgnoreCase(courseId)) {
            return false;
        }
        String status = enrollment.getStatus() == null ? "" : enrollment.getStatus().trim().toUpperCase(Locale.ROOT);
        return !CLOSED_ENROLLMENT.contains(status);
    }

    private static String required(String value, String field) {
        if (value == null || value.isBlank()) {
            throw new IllegalArgumentException(field + " is required");
        }
        return value.trim();
    }

    public static class SchoolMaterialAccessException extends RuntimeException {
        public SchoolMaterialAccessException(String message) {
            super(message);
        }
    }
}
