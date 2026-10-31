package com.ragapi.service;

import com.ragapi.dto.AdminMentorUpdateRequest;
import com.ragapi.dto.AdminTeacherRoleUpdateRequest;
import com.ragapi.dto.AdminUserUpdateRequest;
import com.ragapi.entity.Mentor;
import com.ragapi.entity.QuestionEscalation;
import com.ragapi.entity.User;
import com.ragapi.repository.MentorRepository;
import com.ragapi.repository.QuestionEscalationRepository;
import com.ragapi.repository.UserRepository;
import com.ragapi.util.EscalationOrdering;
import com.ragapi.util.StudentCodeAllocator;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class AdminDashboardService {
    private final UserRepository userRepository;
    private final MentorRepository mentorRepository;
    private final QuestionEscalationRepository questionEscalationRepository;
    private final UserOwnedRecordCleanup userOwnedRecordCleanup;
    private final MongoTemplate mongoTemplate;

    @Value("${admin.account.email:admin@system.local}")
    private String systemAdminEmail;

    public Map<String, Object> getDashboardStats() {
        return Map.of(
                "users", userRepository.count(),
                "mentors", mentorRepository.count(),
                "escalations", questionEscalationRepository.count()
        );
    }

    public List<User> filterUsers(String query, String role, Boolean active) {
        return userRepository.findAll().stream()
                .filter(user -> matchesUserQuery(user, query))
                .filter(user -> role == null || role.isBlank() || role.equalsIgnoreCase(user.getRole()))
                .filter(user -> active == null || user.getIsActive() != null && user.getIsActive().equals(active))
                .collect(Collectors.toList());
    }

    public Map<String, Object> pageUsers(String query, String role, Boolean active, int page, int size) {
        int safeSize = Math.min(Math.max(size, 1), 100);
        Query mongoQuery = userFilterQuery(query, role, active);
        long total = mongoTemplate.count(mongoQuery, User.class);
        int lastPage = total == 0 ? 0 : (int) ((total - 1) / safeSize);
        int safePage = Math.min(Math.max(page, 0), lastPage);
        mongoQuery.with(Sort.by(Sort.Direction.DESC, "createdAt"));
        mongoQuery.skip((long) safePage * safeSize);
        mongoQuery.limit(safeSize);
        List<User> users = mongoTemplate.find(mongoQuery, User.class);
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("users", users);
        body.put("totalElements", total);
        body.put("page", safePage);
        body.put("size", safeSize);
        body.put("count", users.size());
        return body;
    }

    private Query userFilterQuery(String query, String role, Boolean active) {
        Query mongoQuery = new Query();
        if (role != null && !role.isBlank()) {
            mongoQuery.addCriteria(Criteria.where("role").regex("^" + Pattern.quote(role.trim()) + "$", "i"));
        }
        if (active != null) {
            mongoQuery.addCriteria(Criteria.where("isActive").is(active));
        }
        if (query != null && !query.isBlank()) {
            String pattern = ".*" + Pattern.quote(query.trim()) + ".*";
            mongoQuery.addCriteria(new Criteria().orOperator(
                    Criteria.where("email").regex(pattern, "i"),
                    Criteria.where("fullName").regex(pattern, "i"),
                    Criteria.where("phone").regex(pattern, "i"),
                    Criteria.where("studentCode").regex(pattern, "i"),
                    Criteria.where("role").regex(pattern, "i")
            ));
        }
        return mongoQuery;
    }

    public void deleteUser(String userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("User not found"));
        if (isProtectedSystemAdmin(user)) {
            throw new IllegalArgumentException("System admin account cannot be deleted.");
        }

        mentorRepository.findById(user.getId()).ifPresent(mentorRepository::delete);
        String email = user.getEmail() == null ? "" : user.getEmail().trim();
        if (!email.isBlank()) {
            mentorRepository.findByEmail(email)
                    .filter(mentor -> !user.getId().equals(mentor.getId()))
                    .ifPresent(mentorRepository::delete);
        }
        userOwnedRecordCleanup.deleteOwnedRecords(user);
        userRepository.delete(user);
    }

    public User updateUser(String userId, AdminUserUpdateRequest request) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("User not found"));

        if (request.getIsActive() != null) {
            user.setIsActive(request.getIsActive());
        }
        if (request.getRole() != null && !request.getRole().isBlank()) {
            user.setRole(request.getRole());
        }
        if (StudentCodeAllocator.prefixForRole(user.getRole()) != null
                && !StudentCodeAllocator.matchesRole(user.getStudentCode(), user.getRole())) {
            user.setStudentCode(StudentCodeAllocator.allocateForRole(user.getRole(), userRepository::existsByStudentCode));
        }
        user.setUpdatedAt(LocalDateTime.now());

        return userRepository.save(user);
    }

    public List<Mentor> filterMentors(String query, Boolean active, Boolean verified, String city) {
        return mentorRepository.findAll().stream()
                .filter(mentor -> matchesMentorQuery(mentor, query))
                .filter(mentor -> active == null || mentor.getIsActive() != null && mentor.getIsActive().equals(active))
                .filter(mentor -> verified == null || mentor.getVerified() != null && mentor.getVerified().equals(verified))
                .filter(mentor -> city == null || city.isBlank() || city.equalsIgnoreCase(safe(mentor.getCity())))
                .collect(Collectors.toList());
    }

    public void deleteMentor(String mentorId) {
        Mentor mentor = mentorRepository.findById(mentorId)
                .orElseThrow(() -> new RuntimeException("Mentor not found"));
        mentorRepository.delete(mentor);
    }

    public Mentor updateMentor(String mentorId, AdminMentorUpdateRequest request) {
        Mentor mentor = mentorRepository.findById(mentorId)
                .orElseThrow(() -> new RuntimeException("Mentor not found"));

        if (request.getIsActive() != null) {
            mentor.setIsActive(request.getIsActive());
        }
        if (request.getVerified() != null) {
            mentor.setVerified(request.getVerified());
        }
        mentor.setUpdatedAt(LocalDateTime.now());

        return mentorRepository.save(mentor);
    }

    public Map<String, Object> updateTeacherRole(String teacherId, AdminTeacherRoleUpdateRequest request) {
        if (request == null || request.getRole() == null || request.getRole().isBlank()) {
            throw new IllegalArgumentException("role is required");
        }

        String role = request.getRole().trim().toUpperCase(Locale.ROOT);
        if (!"TEACHER".equals(role) && !"SENIOR_MENTOR".equals(role)) {
            throw new IllegalArgumentException("role must be TEACHER or SENIOR_MENTOR");
        }

        Mentor mentor = mentorRepository.findById(teacherId)
                .orElseThrow(() -> new IllegalArgumentException("Teacher not found"));

        User user = userRepository.findById(teacherId)
                .or(() -> mentor.getEmail() == null ? java.util.Optional.empty()
                        : userRepository.findByEmail(mentor.getEmail().trim()))
                .orElseThrow(() -> new IllegalArgumentException(
                        "Teacher login account not found. Restart the API once to synchronize mentor accounts."));

        String previousRole = user.getRole();
        user.setRole(role);
        if (!StudentCodeAllocator.matchesRole(user.getStudentCode(), role)) {
            user.setStudentCode(StudentCodeAllocator.allocateForRole(role, userRepository::existsByStudentCode));
        }
        user.setUpdatedAt(LocalDateTime.now());
        userRepository.save(user);

        return Map.of(
                "teacherId", mentor.getId(),
                "teacherName", mentor.getMentorName() == null ? "" : mentor.getMentorName(),
                "email", mentor.getEmail() == null ? "" : mentor.getEmail(),
                "previousRole", previousRole == null ? "" : previousRole,
                "role", role,
                "message", "Role updated. The teacher must sign in again to receive a new JWT."
        );
    }

    public List<QuestionEscalation> filterMentorEscalations(String status, String userId, String mentorId,
                                                         LocalDateTime from, LocalDateTime to) {
        return questionEscalationRepository.findAll().stream()
                .filter(request -> status == null || status.isBlank() || status.equalsIgnoreCase(request.getStatus()))
                .filter(request -> userId == null || userId.isBlank() || userId.equals(request.getUserId()))
                .filter(request -> mentorId == null || mentorId.isBlank()
                        || mentorId.equals(request.getAssignedMentorId()))
                .filter(request -> withinRange(request.getCreatedAt(), from, to))
                .sorted(EscalationOrdering.newestFirst())
                .collect(Collectors.toList());
    }

    public void deleteMentorEscalation(String escalationId) {
        QuestionEscalation request = questionEscalationRepository.findById(escalationId)
                .orElseThrow(() -> new RuntimeException("Escalation not found"));
        questionEscalationRepository.delete(request);
    }

    private boolean isProtectedSystemAdmin(User user) {
        if (user == null) {
            return false;
        }
        boolean defaultAdminEmail = user.getEmail() != null
                && systemAdminEmail != null
                && user.getEmail().equalsIgnoreCase(systemAdminEmail);
        boolean adminRole = user.getRole() != null && "ADMIN".equalsIgnoreCase(user.getRole());
        return defaultAdminEmail || (adminRole && "admin@system.local".equalsIgnoreCase(user.getEmail()));
    }
    private boolean matchesUserQuery(User user, String query) {
        if (query == null || query.isBlank()) {
            return true;
        }
        String needle = query.toLowerCase(Locale.ROOT);
        return safe(user.getEmail()).contains(needle)
                || safe(user.getFullName()).contains(needle)
                || safe(user.getPhone()).contains(needle)
                || safe(user.getStudentCode()).contains(needle)
                || safe(user.getRole()).contains(needle);
    }

    private boolean matchesMentorQuery(Mentor mentor, String query) {
        if (query == null || query.isBlank()) {
            return true;
        }
        String needle = query.toLowerCase(Locale.ROOT);
        return safe(mentor.getMentorName()).contains(needle)
                || safe(mentor.getEmail()).contains(needle)
                || safe(mentor.getPhone()).contains(needle)
                || safe(mentor.getMentorCode()).contains(needle);
    }

    private String safe(String value) {
        return value == null ? "" : value.toLowerCase(Locale.ROOT);
    }

    private boolean withinRange(LocalDateTime value, LocalDateTime from, LocalDateTime to) {
        if (value == null) {
            return true;
        }
        if (from != null && value.isBefore(from)) {
            return false;
        }
        if (to != null && value.isAfter(to)) {
            return false;
        }
        return true;
    }

}





