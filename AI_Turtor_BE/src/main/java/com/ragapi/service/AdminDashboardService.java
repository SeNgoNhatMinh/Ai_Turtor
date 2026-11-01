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
                .filter(user -> user.getDeletedAt() == null)
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
        mongoQuery.addCriteria(Criteria.where("deletedAt").is(null));
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
        deleteUser(userId, "SYSTEM_ADMIN");
    }

    /**
     * Deactivate and anonymize an account while preserving stable references
     * used by enrollments, submissions, grades and teaching history.
     */
    public void deleteUser(String userId, String deletedBy) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("User not found"));
        if (isProtectedSystemAdmin(user)) {
            throw new IllegalArgumentException("System admin account cannot be deleted.");
        }
        if (user.getDeletedAt() != null) {
            return;
        }

        mentorRepository.findById(user.getId()).ifPresent(mentor -> {
            mentor.setIsActive(false);
            mentor.setUpdatedAt(LocalDateTime.now());
            mentorRepository.save(mentor);
        });
        String email = user.getEmail() == null ? "" : user.getEmail().trim();
        if (!email.isBlank()) {
            mentorRepository.findByEmail(email)
                    .filter(mentor -> !user.getId().equals(mentor.getId()))
                    .ifPresent(mentor -> {
                        mentor.setIsActive(false);
                        mentor.setUpdatedAt(LocalDateTime.now());
                        mentorRepository.save(mentor);
                    });
        }
        userOwnedRecordCleanup.revokeAccessRecords(user);

        LocalDateTime now = LocalDateTime.now();
        user.setIsActive(false);
        user.setEmail("deleted+" + user.getId() + "@system.invalid");
        user.setPassword(null);
        user.setPhone(null);
        user.setFullName("Deleted user");
        user.setAvatarUrl(null);
        user.setBio(null);
        user.setAddress(null);
        user.setCity(null);
        user.setIsEmailVerified(false);
        user.setEmailVerifiedAt(null);
        user.setLastLoginAt(null);
        user.setDeletedAt(now);
        user.setDeletedBy(deletedBy == null || deletedBy.isBlank() ? "SYSTEM_ADMIN" : deletedBy);
        user.setDeletionReason("ADMIN_ACCOUNT_DELETION");
        user.setUpdatedAt(now);
        userRepository.save(user);
    }

    public User updateUser(String userId, AdminUserUpdateRequest request) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("User not found"));
        if (user.getDeletedAt() != null) {
            throw new IllegalArgumentException("Deleted account cannot be updated or reactivated.");
        }

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
        Map<String, User> currentUsers = userRepository.findAll().stream()
                .collect(Collectors.toMap(User::getId, user -> user, (left, right) -> left));
        return questionEscalationRepository.findAll().stream()
                .filter(request -> request.getHiddenFromAdminAt() == null)
                .filter(request -> isVisibleStudentTicket(currentUsers.get(request.getUserId())))
                .filter(request -> status == null || status.isBlank() || status.equalsIgnoreCase(request.getStatus()))
                .filter(request -> userId == null || userId.isBlank() || userId.equals(request.getUserId()))
                .filter(request -> mentorId == null || mentorId.isBlank()
                        || mentorId.equals(request.getAssignedMentorId()))
                .filter(request -> withinRange(request.getCreatedAt(), from, to))
                .peek(request -> refreshCurrentUserSnapshot(request, currentUsers.get(request.getUserId())))
                .sorted(EscalationOrdering.newestFirst())
                .collect(Collectors.toList());
    }

    public void archiveMentorEscalation(String escalationId, String archivedBy) {
        QuestionEscalation request = questionEscalationRepository.findById(escalationId)
                .orElseThrow(() -> new RuntimeException("Escalation not found"));
        if (request.getHiddenFromAdminAt() != null) {
            return;
        }
        if ("IN_CHAT".equalsIgnoreCase(request.getStatus())
                || (request.getChatRoomId() != null && !request.getChatRoomId().isBlank()
                && !isTerminalEscalationStatus(request.getStatus()))) {
            throw new IllegalArgumentException(
                    "Active chat must be closed before the escalation can be archived.");
        }
        LocalDateTime now = LocalDateTime.now();
        if (!isTerminalEscalationStatus(request.getStatus())) {
            request.setStatus("CANCELLED");
            request.setCancelReason("ADMIN_ARCHIVED");
            request.setIdempotencyKey(null);
            request.setHiddenFromMentorInboxAt(now);
        }
        request.setHiddenFromAdminAt(now);
        request.setHiddenFromAdminBy(archivedBy == null || archivedBy.isBlank() ? "SYSTEM_ADMIN" : archivedBy);
        request.setUpdatedAt(now);
        questionEscalationRepository.save(request);
    }

    /** Backwards-compatible name; this no longer physically deletes Mongo data. */
    public void deleteMentorEscalation(String escalationId) {
        archiveMentorEscalation(escalationId, "SYSTEM_ADMIN");
    }

    private void refreshCurrentUserSnapshot(QuestionEscalation request, User currentUser) {
        if (request == null || currentUser == null) {
            return;
        }
        if (currentUser.getFullName() != null && !currentUser.getFullName().isBlank()) {
            request.setUserName(currentUser.getFullName());
        }
        if (currentUser.getEmail() != null && !currentUser.getEmail().isBlank()) {
            request.setUserEmail(currentUser.getEmail());
        }
    }

    private boolean isVisibleStudentTicket(User currentUser) {
        return currentUser != null
                && currentUser.getDeletedAt() == null
                && Boolean.TRUE.equals(currentUser.getIsActive())
                && "STUDENT".equalsIgnoreCase(currentUser.getRole());
    }

    private boolean isTerminalEscalationStatus(String status) {
        if (status == null) {
            return false;
        }
        String normalized = status.trim().toUpperCase(Locale.ROOT);
        return normalized.equals("CANCELLED")
                || normalized.equals("COMPLETED")
                || normalized.startsWith("RESOLVED")
                || normalized.startsWith("ANSWERED");
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





