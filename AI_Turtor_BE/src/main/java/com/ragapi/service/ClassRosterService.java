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
import java.util.regex.Pattern;

@Service
@RequiredArgsConstructor
public class ClassRosterService {

    private static final Set<String> STAFF_ROLES = Set.of("ADMIN", "TEACHER", "SENIOR_MENTOR", "MENTOR");
    private static final Pattern ACCOUNT_ID = Pattern.compile(
            "^[a-fA-F0-9]{8}-[a-fA-F0-9]{4}-[1-5][a-fA-F0-9]{3}-[89abAB][a-fA-F0-9]{3}-[a-fA-F0-9]{12}$"
    );

    private final UserRepository userRepository;
    private final CourseEnrollmentRepository courseEnrollmentRepository;

    public List<CourseEnrollment> listClassStudents(String courseId, String classId) {
        List<CourseEnrollment> roster = new ArrayList<>();
        for (CourseEnrollment enrollment : courseEnrollmentRepository.findByCourseIdAndClassId(courseId, classId)) {
            if (removeOrphanAccountEnrollment(enrollment)) {
                continue;
            }
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
        applyAccountIdentity(enrollment, true);
        return enrollment;
    }

    public void copyProfileOnto(CourseEnrollment enrollment) {
        applyAccountIdentity(enrollment, false);
    }

    public boolean removeOrphanAccountEnrollment(CourseEnrollment enrollment) {
        if (enrollment == null || !looksLikeAccountId(enrollment.getStudentId())) {
            return false;
        }
        if (resolveUser(enrollment).isPresent()) {
            return false;
        }
        courseEnrollmentRepository.delete(enrollment);
        return true;
    }

    private static boolean looksLikeAccountId(String value) {
        return hasText(value) && ACCOUNT_ID.matcher(value.trim()).matches();
    }

    private boolean applyAccountIdentity(CourseEnrollment enrollment, boolean persist) {
        if (enrollment == null) {
            return false;
        }
        Optional<User> account = resolveUser(enrollment);
        if (account.isEmpty()) {
            return false;
        }
        User user = account.get();
        boolean changed = false;
        if (hasText(user.getFullName()) && !user.getFullName().trim().equals(trimToNull(enrollment.getStudentName()))) {
            enrollment.setStudentName(user.getFullName().trim());
            changed = true;
        }
        if (hasText(user.getEmail()) && !user.getEmail().trim().equalsIgnoreCase(String.valueOf(enrollment.getStudentEmail()))) {
            enrollment.setStudentEmail(user.getEmail().trim());
            changed = true;
        }
        if (isBlank(enrollment.getStudentPhone()) && hasText(user.getPhone())) {
            enrollment.setStudentPhone(user.getPhone().trim());
            changed = true;
        }
        if (hasText(user.getStudentCode())
                && !user.getStudentCode().trim().equals(trimToNull(enrollment.getStudentCode()))) {
            enrollment.setStudentCode(user.getStudentCode().trim());
            changed = true;
        } else if (isBlank(enrollment.getStudentCode()) && hasText(enrollment.getStudentId())
                && !looksLikeAccountId(enrollment.getStudentId())) {
            enrollment.setStudentCode(enrollment.getStudentId().trim());
            changed = true;
        }
        if (hasText(user.getId()) && !user.getId().equals(enrollment.getStudentId()) && !hasCanonicalStudentCollision(enrollment, user.getId())) {
            enrollment.setStudentId(user.getId());
            changed = true;
        }
        if (changed && persist) {
            enrollment.setUpdatedAt(LocalDateTime.now());
            courseEnrollmentRepository.save(enrollment);
        }
        return changed;
    }

    private boolean hasCanonicalStudentCollision(CourseEnrollment enrollment, String accountId) {
        if (isBlank(accountId) || isBlank(enrollment.getCourseId()) || isBlank(enrollment.getClassId())) {
            return false;
        }
        return courseEnrollmentRepository
                .findByStudentIdAndCourseIdAndClassId(accountId, enrollment.getCourseId(), enrollment.getClassId())
                .filter(other -> enrollment.getId() == null || !enrollment.getId().equals(other.getId()))
                .isPresent();
    }

    Optional<User> resolveUser(CourseEnrollment enrollment) {
        if (enrollment == null) {
            return Optional.empty();
        }
        for (Optional<User> candidate : List.of(
                findUserById(enrollment.getStudentId()),
                findUserByEmail(enrollment.getStudentId()),
                findUserByStudentCode(enrollment.getStudentId()),
                findUserByEmail(enrollment.getStudentEmail()),
                findUserByStudentCode(enrollment.getStudentCode())
        )) {
            if (candidate.isPresent()) {
                return candidate;
            }
        }
        return Optional.empty();
    }

    private Optional<User> findUserById(String value) {
        return hasText(value) ? emptyIfNull(userRepository.findById(value.trim())) : Optional.empty();
    }

    private Optional<User> findUserByEmail(String value) {
        return hasText(value) ? emptyIfNull(userRepository.findByEmail(value.trim())) : Optional.empty();
    }

    private Optional<User> findUserByStudentCode(String value) {
        return hasText(value) ? emptyIfNull(userRepository.findByStudentCode(value.trim())) : Optional.empty();
    }

    private static Optional<User> emptyIfNull(Optional<User> value) {
        return value == null ? Optional.empty() : value;
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
