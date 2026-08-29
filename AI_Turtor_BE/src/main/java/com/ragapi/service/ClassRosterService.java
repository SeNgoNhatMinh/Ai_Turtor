package com.ragapi.service;

import com.ragapi.entity.CourseEnrollment;
import com.ragapi.entity.User;
import com.ragapi.repository.CourseEnrollmentRepository;
import com.ragapi.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
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
