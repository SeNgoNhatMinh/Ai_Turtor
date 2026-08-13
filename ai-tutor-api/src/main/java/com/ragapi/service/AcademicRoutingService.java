package com.ragapi.service;

import com.ragapi.entity.ClassSection;
import com.ragapi.entity.CourseEnrollment;
import com.ragapi.repository.ClassSectionRepository;
import com.ragapi.repository.CourseEnrollmentRepository;
import lombok.AllArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.Locale;
import java.util.Optional;

@Service
@AllArgsConstructor
public class AcademicRoutingService {

    private final ClassSectionRepository classSectionRepository;
    private final CourseEnrollmentRepository enrollmentRepository;

    public EscalationRoute resolveRoute(String studentId, String courseId, String classId) {
        if (isBlank(courseId) || isBlank(classId)) {
            return EscalationRoute.mentorMatching("Missing courseId or classId");
        }

        Optional<ClassSection> classSectionOpt = classSectionRepository
                .findByCourseIdAndClassId(courseId.trim(), classId.trim());

        Optional<CourseEnrollment> enrollmentOpt = Optional.empty();
        if (!isBlank(studentId)) {
            enrollmentOpt = enrollmentRepository.findByStudentIdAndCourseIdAndClassId(
                    studentId.trim(),
                    courseId.trim(),
                    classId.trim()
            );
        }

        if (enrollmentOpt.isPresent() && isCompleted(enrollmentOpt.get().getStatus())) {
            return EscalationRoute.mentorMatching("Student completed this course");
        }

        if (enrollmentOpt.isPresent() && isActive(enrollmentOpt.get().getStatus()) && classSectionOpt.isPresent()) {
            return EscalationRoute.classTeacher(classSectionOpt.get(), "Active enrollment routes to class teacher");
        }

        if (enrollmentOpt.isEmpty() && classSectionOpt.isPresent() && isActive(classSectionOpt.get().getStatus())) {
            return EscalationRoute.classTeacher(classSectionOpt.get(), "Active class section routes to class teacher");
        }

        if (classSectionOpt.isPresent() && isCompleted(classSectionOpt.get().getStatus())) {
            return EscalationRoute.mentorMatching("Class section is completed");
        }

        return EscalationRoute.mentorMatching("No active class teacher route found");
    }

    private boolean isActive(String status) {
        String normalized = normalizeStatus(status);
        return normalized.isEmpty() || "ACTIVE".equals(normalized) || "IN_PROGRESS".equals(normalized);
    }

    private boolean isCompleted(String status) {
        String normalized = normalizeStatus(status);
        return "COMPLETED".equals(normalized) || "FINISHED".equals(normalized) || "CLOSED".equals(normalized);
    }

    private String normalizeStatus(String status) {
        return status == null ? "" : status.trim().toUpperCase(Locale.ROOT);
    }

    private boolean isBlank(String value) {
        return value == null || value.isBlank();
    }

    public record EscalationRoute(
            boolean routeToClassTeacher,
            ClassSection classSection,
            String reason
    ) {
        static EscalationRoute classTeacher(ClassSection classSection, String reason) {
            return new EscalationRoute(true, classSection, reason);
        }

        static EscalationRoute mentorMatching(String reason) {
            return new EscalationRoute(false, null, reason);
        }
    }
}
