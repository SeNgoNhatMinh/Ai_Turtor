package com.ragapi.service;

import com.ragapi.entity.ClassSection;
import com.ragapi.repository.ClassSectionRepository;
import com.ragapi.repository.CourseEnrollmentRepository;
import lombok.AllArgsConstructor;
import org.springframework.stereotype.Service;

@Service
@AllArgsConstructor
public class AccessGuardService {

    private final ClassSectionRepository classSectionRepository;
    private final CourseEnrollmentRepository enrollmentRepository;

    public boolean isAdmin(String role) {
        return role != null && "ADMIN".equalsIgnoreCase(role.trim());
    }

    public boolean isTeacher(String role) {
        return role != null && ("TEACHER".equalsIgnoreCase(role.trim()) || "MENTOR".equalsIgnoreCase(role.trim()));
    }

    public boolean isStudent(String role) {
        return role != null && "STUDENT".equalsIgnoreCase(role.trim());
    }

    public void allowStudentSelfOrAdmin(String requesterId, String requesterRole, String studentId) {
        if (isBlank(requesterId) && isBlank(requesterRole)) {
            return;
        }
        if (isAdmin(requesterRole)) {
            return;
        }
        if (!isBlank(requesterId) && requesterId.equals(studentId)) {
            return;
        }
        throw new IllegalArgumentException("Requester is not allowed to access this student resource");
    }

    public void allowTeacherForClassOrAdmin(String requesterId, String requesterRole, String courseId, String classId) {
        if (isBlank(requesterId) && isBlank(requesterRole)) {
            return;
        }
        if (isAdmin(requesterRole)) {
            return;
        }
        ClassSection section = classSectionRepository.findByCourseIdAndClassId(courseId, classId)
                .orElseThrow(() -> new IllegalArgumentException("Class section not found"));
        if (!isBlank(requesterId) && requesterId.equals(section.getTeacherId())) {
            return;
        }
        throw new IllegalArgumentException("Requester is not the teacher of this class section");
    }

    public void allowStudentEnrollmentOrTeacherOrAdmin(String requesterId, String requesterRole, String studentId, String courseId, String classId) {
        if (isBlank(requesterId) && isBlank(requesterRole)) {
            return;
        }
        if (isAdmin(requesterRole)) {
            return;
        }
        if (!isBlank(requesterId) && requesterId.equals(studentId)) {
            return;
        }
        if (isTeacher(requesterRole) && !isBlank(requesterId)) {
            ClassSection section = classSectionRepository.findByCourseIdAndClassId(courseId, classId)
                    .orElse(null);
            if (section != null && requesterId.equals(section.getTeacherId())) {
                return;
            }
        }
        boolean enrolled = enrollmentRepository.findByStudentIdAndCourseIdAndClassId(studentId, courseId, classId).isPresent();
        if (enrolled && !isBlank(requesterId) && requesterId.equals(studentId)) {
            return;
        }
        throw new IllegalArgumentException("Requester is not allowed for this student/course/class resource");
    }

    public void requireAdmin(String requesterRole) {
        if (!isBlank(requesterRole) && isAdmin(requesterRole)) {
            return;
        }
        throw new IllegalArgumentException("ADMIN role is required for this operation");
    }

    private boolean isBlank(String value) {
        return value == null || value.isBlank();
    }
}
