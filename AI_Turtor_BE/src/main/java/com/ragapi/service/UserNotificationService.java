package com.ragapi.service;

import com.ragapi.entity.GoldQa;
import com.ragapi.entity.KnowledgeCandidate;
import com.ragapi.entity.QuestionEscalation;
import com.ragapi.entity.User;
import com.ragapi.entity.UserNotification;
import com.ragapi.repository.UserNotificationRepository;
import com.ragapi.repository.UserRepository;
import com.ragapi.util.RichTextPlainText;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class UserNotificationService {
    public static final String SUPPORT_REPLY = "SUPPORT_REPLY";
    public static final String SUPPORT_REQUEST = "SUPPORT_REQUEST";
    public static final String KNOWLEDGE_REVIEW = "KNOWLEDGE_REVIEW";
    public static final String GOLD_QA_REVIEW = "GOLD_QA_REVIEW";

    static final int PREVIEW_LIMIT = 140;
    private static final List<String> REVIEWER_ROLES = List.of("SENIOR_MENTOR", "ADMIN");

    private final UserNotificationRepository repository;
    private final UserRepository userRepository;
    private final RealtimeEventService realtimeEvents;

    public UserNotification recordTeacherReply(QuestionEscalation escalation, String teacherName) {
        if (escalation == null || blank(escalation.getUserId())) {
            return null;
        }
        return save(base()
                .userId(escalation.getUserId())
                .type(SUPPORT_REPLY)
                .title(displayName(teacherName, "Giảng viên") + " đã phản hồi yêu cầu hỗ trợ")
                .body(preview(RichTextPlainText.toPlain(escalation.getOriginalQuestion()),
                        "Yêu cầu hỗ trợ của bạn đã có câu trả lời."))
                .questionEscalationId(escalation.getId())
                .courseId(escalation.getCourseId())
                .classId(escalation.getClassId())
                .entityType("QUESTION_ESCALATION")
                .entityId(escalation.getId())
                .linkPath("/student/mentor-review?ticket=" + escalation.getId())
                .build());
    }

    public UserNotification recordSupportRequestForTeacher(QuestionEscalation escalation, String teacherUserId) {
        if (escalation == null || blank(teacherUserId)) {
            return null;
        }
        return save(supportRequestBuilder(escalation)
                .userId(teacherUserId.trim())
                .linkPath("/teacher/review-queue")
                .body(preview(RichTextPlainText.toPlain(escalation.getOriginalQuestion()),
                        "Có yêu cầu hỗ trợ mới cần phản hồi."))
                .build());
    }

    public List<UserNotification> recordSupportRequestForAdmins(QuestionEscalation escalation) {
        if (escalation == null) return List.of();
        return notifyRoles(
                List.of("ADMIN"),
                SUPPORT_REQUEST,
                supportRequestTitle(escalation),
                preview(RichTextPlainText.toPlain(escalation.getOriginalQuestion()), "Có yêu cầu hỗ trợ mới."),
                "/admin/users/escalations",
                "QUESTION_ESCALATION",
                escalation.getId(),
                escalation.getCourseId(),
                escalation.getClassId(),
                escalation.getId()
        );
    }

    public List<UserNotification> recordKnowledgeReview(KnowledgeCandidate candidate) {
        if (candidate == null || blank(candidate.getId())) return List.of();
        String body = preview(RichTextPlainText.toPlain(candidate.getQuestion()),
                "Có đề xuất tri thức AI cần phê duyệt.");
        String title = "Tri thức mới chờ duyệt" + courseSuffix(candidate.getCourseId());
        List<UserNotification> saved = new ArrayList<>();
        for (User user : activeUsers(REVIEWER_ROLES)) {
            saved.add(save(base()
                    .userId(user.getId())
                    .type(KNOWLEDGE_REVIEW)
                    .title(title)
                    .body(body)
                    .courseId(candidate.getCourseId())
                    .classId(candidate.getClassId())
                    .questionEscalationId(candidate.getQuestionEscalationId())
                    .entityType("KNOWLEDGE_CANDIDATE")
                    .entityId(candidate.getId())
                    .linkPath(isAdmin(user) ? "/admin/indexed-teaching-notes" : "/senior/review")
                    .build()));
        }
        return saved;
    }

    public List<UserNotification> recordGoldQaReview(GoldQa gold) {
        if (gold == null || blank(gold.getId())) return List.of();
        String body = preview(gold.getQuestion(), "Có bài Gold Q&A chờ duyệt nạp RAG.");
        String title = "Gold Q&A chờ duyệt" + courseSuffix(gold.getCourseId());
        List<UserNotification> saved = new ArrayList<>();
        for (User user : activeUsers(REVIEWER_ROLES)) {
            saved.add(save(base()
                    .userId(user.getId())
                    .type(GOLD_QA_REVIEW)
                    .title(title)
                    .body(body)
                    .courseId(gold.getCourseId())
                    .entityType("GOLD_QA")
                    .entityId(gold.getId())
                    .linkPath(goldReviewLink(user, gold.getCourseId()))
                    .build()));
        }
        return saved;
    }

    /**
     * Publishes one stored notification to its owner, merging inbox fields into the
     * websocket payload. Falls back to role broadcast when nothing was stored.
     */
    public void publishStoredOrRoles(
            List<UserNotification> notifications,
            Collection<String> fallbackRoles,
            String eventType,
            String entityType,
            String entityId,
            String status,
            Map<String, ?> baseData
    ) {
        if (notifications == null || notifications.isEmpty()) {
            realtimeEvents.publishToRoles(fallbackRoles, eventType, entityType, entityId, status, baseData);
            return;
        }
        for (UserNotification notification : notifications) {
            publishStored(notification, eventType, entityType, entityId, status, baseData);
        }
    }

    public void publishStored(
            UserNotification notification,
            String eventType,
            String entityType,
            String entityId,
            String status,
            Map<String, ?> baseData
    ) {
        if (notification == null || blank(notification.getUserId())) return;
        Map<String, Object> data = new LinkedHashMap<>();
        if (baseData != null) data.putAll(baseData);
        data.putAll(realtimePayload(notification));
        realtimeEvents.publishToUser(
                notification.getUserId(),
                eventType,
                entityType,
                entityId,
                status,
                data
        );
    }

    public Map<String, Object> realtimePayload(UserNotification notification) {
        Map<String, Object> data = new LinkedHashMap<>();
        if (notification == null) return data;
        data.put("notificationId", text(notification.getId()));
        data.put("title", text(notification.getTitle()));
        data.put("body", text(notification.getBody()));
        data.put("type", text(notification.getType()));
        data.put("linkPath", text(notification.getLinkPath()));
        data.put("entityType", text(notification.getEntityType()));
        data.put("entityId", text(notification.getEntityId()));
        data.put("questionEscalationId", text(notification.getQuestionEscalationId()));
        data.put("courseId", text(notification.getCourseId()));
        data.put("classId", text(notification.getClassId()));
        data.put("createdAt", notification.getCreatedAt() == null ? "" : notification.getCreatedAt().toString());
        return data;
    }

    public List<UserNotification> listForUser(String userId) {
        return repository.findTop30ByUserIdOrderByCreatedAtDesc(userId);
    }

    public long unreadCount(String userId) {
        return repository.countByUserIdAndReadAtIsNull(userId);
    }

    public UserNotification markRead(String userId, String notificationId) {
        UserNotification notification = repository.findById(notificationId)
                .orElseThrow(() -> new IllegalArgumentException("Notification not found"));
        if (notification.getUserId() == null || !notification.getUserId().equals(userId)) {
            throw new SecurityException("Notification belongs to another user");
        }
        if (notification.getReadAt() == null) {
            notification.setReadAt(LocalDateTime.now());
            notification = repository.save(notification);
        }
        return notification;
    }

    public int markAllRead(String userId) {
        List<UserNotification> unread = repository.findByUserIdAndReadAtIsNull(userId);
        if (unread.isEmpty()) return 0;
        LocalDateTime now = LocalDateTime.now();
        unread.forEach(item -> item.setReadAt(now));
        repository.saveAll(unread);
        return unread.size();
    }

    static String preview(String value) {
        return preview(value, "Yêu cầu hỗ trợ của bạn đã có câu trả lời.");
    }

    static String preview(String value, String fallback) {
        String compact = value == null ? "" : value.replaceAll("\\s+", " ").trim();
        if (compact.isEmpty()) return fallback;
        if (compact.length() <= PREVIEW_LIMIT) return compact;
        return compact.substring(0, PREVIEW_LIMIT - 3) + "...";
    }

    private List<UserNotification> notifyRoles(
            Collection<String> roles,
            String type,
            String title,
            String body,
            String linkPath,
            String entityType,
            String entityId,
            String courseId,
            String classId,
            String questionEscalationId
    ) {
        List<UserNotification> saved = new ArrayList<>();
        for (User user : activeUsers(roles)) {
            saved.add(save(base()
                    .userId(user.getId())
                    .type(type)
                    .title(title)
                    .body(body)
                    .linkPath(linkPath)
                    .entityType(entityType)
                    .entityId(entityId)
                    .courseId(courseId)
                    .classId(classId)
                    .questionEscalationId(questionEscalationId)
                    .build()));
        }
        return saved;
    }

    private UserNotification.UserNotificationBuilder supportRequestBuilder(QuestionEscalation escalation) {
        return base()
                .type(SUPPORT_REQUEST)
                .title(supportRequestTitle(escalation))
                .questionEscalationId(escalation.getId())
                .courseId(escalation.getCourseId())
                .classId(escalation.getClassId())
                .entityType("QUESTION_ESCALATION")
                .entityId(escalation.getId());
    }

    private static String supportRequestTitle(QuestionEscalation escalation) {
        return displayName(escalation.getUserName(), "Sinh viên")
                + " gửi yêu cầu hỗ trợ"
                + courseSuffix(escalation.getCourseId());
    }

    private static String goldReviewLink(User user, String courseId) {
        if (isAdmin(user)) return "/admin/expert-training";
        String link = "/senior/v2?tab=review";
        return blank(courseId) ? link : link + "&courseId=" + courseId;
    }

    private static UserNotification.UserNotificationBuilder base() {
        return UserNotification.builder();
    }

    private UserNotification save(UserNotification notification) {
        if (blank(notification.getId())) {
            notification.setId(UUID.randomUUID().toString());
        }
        if (notification.getCreatedAt() == null) {
            notification.setCreatedAt(LocalDateTime.now());
        }
        return repository.save(notification);
    }

    private List<User> activeUsers(Collection<String> roles) {
        if (roles == null || roles.isEmpty()) return List.of();
        return userRepository.findByRoleInAndIsActiveTrue(roles).stream()
                .filter(user -> !blank(user.getId()))
                .toList();
    }

    private static boolean isAdmin(User user) {
        return user != null && "ADMIN".equalsIgnoreCase(user.getRole());
    }

    private static String courseSuffix(String courseId) {
        return blank(courseId) ? "" : " · " + courseId.trim();
    }

    private static String displayName(String value, String fallback) {
        return blank(value) ? fallback : value.trim();
    }

    private static String text(String value) {
        return value == null ? "" : value;
    }

    private static boolean blank(String value) {
        return value == null || value.isBlank();
    }
}
