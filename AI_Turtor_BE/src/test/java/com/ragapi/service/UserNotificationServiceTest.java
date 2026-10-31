package com.ragapi.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.ragapi.entity.QuestionEscalation;
import com.ragapi.entity.User;
import com.ragapi.entity.UserNotification;
import com.ragapi.repository.UserNotificationRepository;
import com.ragapi.repository.UserRepository;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.Collection;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class UserNotificationServiceTest {

    @Test
    void previewKeepsAShortQuestionAndTruncatesALongOne() {
        assertThat(UserNotificationService.preview("  JDK khác   JRE?  "))
                .isEqualTo("JDK khác JRE?");
        assertThat(UserNotificationService.preview("a".repeat(180)))
                .hasSize(UserNotificationService.PREVIEW_LIMIT)
                .endsWith("...");
        assertThat(UserNotificationService.preview("  "))
                .isEqualTo("Yêu cầu hỗ trợ của bạn đã có câu trả lời.");
    }

    @Test
    void recordTeacherReplyStoresTheNotificationForTheStudent() {
        UserNotificationService service = service(new CapturingRealtime());
        QuestionEscalation escalation = QuestionEscalation.builder()
                .id("escalation-1")
                .userId("student-1")
                .courseId("PRJ301")
                .classId("SE1832")
                .originalQuestion("JDK khác JRE ở điểm nào theo giáo trình?")
                .build();

        UserNotification saved = service.recordTeacherReply(escalation, "Cô Lan");

        assertThat(saved.getUserId()).isEqualTo("student-1");
        assertThat(saved.getQuestionEscalationId()).isEqualTo("escalation-1");
        assertThat(saved.getTitle()).isEqualTo("Cô Lan đã phản hồi yêu cầu hỗ trợ");
        assertThat(saved.getBody()).isEqualTo("JDK khác JRE ở điểm nào theo giáo trình?");
        assertThat(saved.getLinkPath()).isEqualTo("/student/mentor-review?ticket=escalation-1");
        assertThat(saved.getReadAt()).isNull();
        assertThat(saved.getType()).isEqualTo(UserNotificationService.SUPPORT_REPLY);
    }

    @Test
    void recordSupportRequestForTeacherStoresInboxAlert() {
        UserNotificationService service = service(new CapturingRealtime());
        QuestionEscalation escalation = QuestionEscalation.builder()
                .id("escalation-2")
                .userId("student-1")
                .userName("Nhật Minh")
                .courseId("PRJ301")
                .classId("PRJ301-01")
                .originalQuestion("ZebraServlet Ultra 9000 là gì?")
                .build();

        UserNotification saved = service.recordSupportRequestForTeacher(escalation, "teacher-1");

        assertThat(saved.getUserId()).isEqualTo("teacher-1");
        assertThat(saved.getType()).isEqualTo(UserNotificationService.SUPPORT_REQUEST);
        assertThat(saved.getTitle()).contains("Nhật Minh");
        assertThat(saved.getLinkPath()).isEqualTo("/teacher/review-queue");
    }

    @Test
    void recordSupportRequestForAdminsNotifiesActiveAdmins() {
        UserNotificationRepository repository = mock(UserNotificationRepository.class);
        UserRepository users = mock(UserRepository.class);
        when(repository.save(any(UserNotification.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(users.findByRoleInAndIsActiveTrue(anyCollection())).thenReturn(List.of(
                User.builder().id("admin-1").role("ADMIN").isActive(true).build()
        ));
        UserNotificationService service = new UserNotificationService(repository, users, new CapturingRealtime());
        QuestionEscalation escalation = QuestionEscalation.builder()
                .id("escalation-3")
                .userName("Sinh viên")
                .courseId("PFP191")
                .originalQuestion("Câu hỏi ngoài tài liệu")
                .build();

        List<UserNotification> saved = service.recordSupportRequestForAdmins(escalation);

        assertThat(saved).hasSize(1);
        assertThat(saved.get(0).getUserId()).isEqualTo("admin-1");
        assertThat(saved.get(0).getLinkPath()).isEqualTo("/admin/users/escalations");
    }

    @Test
    void publishStoredOrRolesFallsBackToRoleBroadcastWhenEmpty() {
        CapturingRealtime realtime = new CapturingRealtime();
        UserNotificationService service = service(realtime);

        service.publishStoredOrRoles(
                List.of(),
                List.of("SENIOR_MENTOR", "ADMIN"),
                "GOLD_QA_SUBMITTED",
                "GOLD_QA",
                "gold-1",
                "PENDING_REVIEW",
                Map.of("courseId", "PRJ301")
        );

        assertThat(realtime.roleEvents).containsExactly("GOLD_QA_SUBMITTED|GOLD_QA|gold-1");
        assertThat(realtime.userEvents).isEmpty();
    }

    private static UserNotificationService service(RealtimeEventService realtime) {
        UserNotificationRepository repository = mock(UserNotificationRepository.class);
        UserRepository users = mock(UserRepository.class);
        when(repository.save(any(UserNotification.class))).thenAnswer(invocation -> invocation.getArgument(0));
        return new UserNotificationService(repository, users, realtime);
    }

    /** Avoids Mockito inline mocks for RealtimeEventService on newer JDKs. */
    private static final class CapturingRealtime extends RealtimeEventService {
        private final List<String> roleEvents = new ArrayList<>();
        private final List<String> userEvents = new ArrayList<>();

        private CapturingRealtime() {
            super(new ObjectMapper());
        }

        @Override
        public void publishToRoles(Iterable<String> roles, String eventType, String entityType,
                                   String entityId, String status, Map<String, ?> data) {
            roleEvents.add(eventType + "|" + entityType + "|" + entityId);
        }

        @Override
        public void publishToUser(String userId, String eventType, String entityType,
                                  String entityId, String status, Map<String, ?> data) {
            userEvents.add(userId + "|" + eventType);
        }
    }
}
