package com.ragapi.service;

import com.ragapi.entity.CourseEnrollment;
import com.ragapi.entity.PedagogicalDirective;
import com.ragapi.entity.TutorSession;
import com.ragapi.entity.TutorSessionSummary;
import com.ragapi.entity.User;
import com.ragapi.repository.CourseEnrollmentRepository;
import com.ragapi.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

@Service
@RequiredArgsConstructor
public class ClassRosterService {

    private static final Set<String> STAFF_ROLES = Set.of("ADMIN", "TEACHER", "SENIOR_MENTOR", "MENTOR");

    private final UserRepository userRepository;
    private final CourseEnrollmentRepository courseEnrollmentRepository;

    public List<CourseEnrollment> listClassStudents(String courseId, String classId) {
        List<CourseEnrollment> roster = new ArrayList<>();
        for (CourseEnrollment enrollment : courseEnrollmentRepository.findByCourseIdAndClassId(courseId, classId)) {
            Optional<User> account = resolveUser(enrollment);
            if (account.isPresent() && isStaffRole(account.get().getRole())) {
                courseEnrollmentRepository.delete(enrollment);
                continue;
            }
            roster.add(hydrateFromUserAccount(enrollment));
        }
        return roster;
    }

    public Map<String, CourseEnrollment> indexClassStudents(String courseId, String classId) {
        Map<String, CourseEnrollment> index = new LinkedHashMap<>();
        if (isBlank(courseId) || isBlank(classId)) {
            return index;
        }
        for (CourseEnrollment enrollment : listClassStudents(courseId, classId)) {
            if (hasText(enrollment.getStudentId())) {
                index.putIfAbsent(enrollment.getStudentId().trim(), enrollment);
            }
        }
        return index;
    }

    public CourseEnrollment resolveStudent(String studentId, String courseId, String classId) {
        return resolveStudent(studentId, courseId, classId, null);
    }

    public CourseEnrollment resolveStudent(
            String studentId,
            String courseId,
            String classId,
            Map<String, CourseEnrollment> roster
    ) {
        if (isBlank(studentId)) {
            return null;
        }
        String id = studentId.trim();
        if (roster != null && roster.containsKey(id)) {
            return roster.get(id);
        }
        if (hasText(courseId) && hasText(classId)) {
            Optional<CourseEnrollment> enrollment = courseEnrollmentRepository
                    .findByStudentIdAndCourseIdAndClassId(id, courseId, classId);
            if (enrollment.isPresent()) {
                return hydrateFromUserAccount(enrollment.get());
            }
        }
        Optional<User> account = userRepository.findById(id);
        if (account.isEmpty()) {
            account = userRepository.findByEmail(id);
        }
        if (account.isEmpty()) {
            return CourseEnrollment.builder().studentId(id).build();
        }
        User user = account.get();
        return CourseEnrollment.builder()
                .studentId(id)
                .studentName(trimToNull(user.getFullName()))
                .studentEmail(trimToNull(user.getEmail()))
                .build();
    }

    public void copyIdentity(CourseEnrollment source, TutorSessionSummary summary) {
        if (source == null || summary == null) {
            return;
        }
        summary.setStudentName(trimToNull(source.getStudentName()));
        summary.setStudentCode(trimToNull(source.getStudentCode()));
        summary.setStudentEmail(trimToNull(source.getStudentEmail()));
    }

    public void copyIdentity(CourseEnrollment source, PedagogicalDirective directive) {
        if (source == null || directive == null) {
            return;
        }
        directive.setStudentName(trimToNull(source.getStudentName()));
        directive.setStudentCode(trimToNull(source.getStudentCode()));
        directive.setStudentEmail(trimToNull(source.getStudentEmail()));
    }

    public void copyIdentity(CourseEnrollment source, TutorSession session) {
        if (source == null || session == null) {
            return;
        }
        session.setStudentName(trimToNull(source.getStudentName()));
        session.setStudentCode(trimToNull(source.getStudentCode()));
        session.setStudentEmail(trimToNull(source.getStudentEmail()));
    }

    private static String trimToNull(String value) {
        return isBlank(value) ? null : value.trim();
    }

    public void rejectIfStaffAccount(CourseEnrollment enrollment) {
        resolveUser(enrollment).ifPresent(user -> {
            if (isStaffRole(user.getRole())) {
                throw new IllegalArgumentException("Only STUDENT accounts can be enrolled in a class");
            }
        });
    }

    public CourseEnrollment hydrateFromUserAccount(CourseEnrollment enrollment) {
        if (enrollment == null) {
            return null;
        }
        Optional<User> account = resolveUser(enrollment);
        if (account.isEmpty()) {
            return enrollment;
        }
        User user = account.get();
        boolean changed = false;
        if (isBlank(enrollment.getStudentName()) && hasText(user.getFullName())) {
            enrollment.setStudentName(user.getFullName().trim());
            changed = true;
        }
        if (isBlank(enrollment.getStudentEmail()) && hasText(user.getEmail())) {
            enrollment.setStudentEmail(user.getEmail().trim());
            changed = true;
        }
        if (isBlank(enrollment.getStudentPhone()) && hasText(user.getPhone())) {
            enrollment.setStudentPhone(user.getPhone().trim());
            changed = true;
        }
        if (changed) {
            enrollment.setUpdatedAt(LocalDateTime.now());
            return courseEnrollmentRepository.save(enrollment);
        }
        return enrollment;
    }

    public void copyProfileOnto(CourseEnrollment enrollment) {
        if (enrollment == null) {
            return;
        }
        resolveUser(enrollment).ifPresent(user -> {
            if (isBlank(enrollment.getStudentName()) && hasText(user.getFullName())) {
                enrollment.setStudentName(user.getFullName().trim());
            }
            if (isBlank(enrollment.getStudentEmail()) && hasText(user.getEmail())) {
                enrollment.setStudentEmail(user.getEmail().trim());
            }
            if (isBlank(enrollment.getStudentPhone()) && hasText(user.getPhone())) {
                enrollment.setStudentPhone(user.getPhone().trim());
            }
        });
    }

    private Optional<User> resolveUser(CourseEnrollment enrollment) {
        if (hasText(enrollment.getStudentId())) {
            Optional<User> byId = userRepository.findById(enrollment.getStudentId().trim());
            if (byId.isPresent()) {
                return byId;
            }
            Optional<User> byIdAsEmail = userRepository.findByEmail(enrollment.getStudentId().trim());
            if (byIdAsEmail.isPresent()) {
                return byIdAsEmail;
            }
        }
        if (hasText(enrollment.getStudentEmail())) {
            return userRepository.findByEmail(enrollment.getStudentEmail().trim());
        }
        return Optional.empty();
    }

    private static boolean isStaffRole(String role) {
        return role != null && STAFF_ROLES.contains(role.trim().toUpperCase());
    }

    private static boolean hasText(String value) {
        return value != null && !value.isBlank();
    }

    private static boolean isBlank(String value) {
        return value == null || value.isBlank();
    }
}
