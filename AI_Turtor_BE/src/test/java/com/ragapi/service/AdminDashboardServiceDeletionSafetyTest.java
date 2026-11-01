package com.ragapi.service;

import com.ragapi.entity.QuestionEscalation;
import com.ragapi.entity.User;
import com.ragapi.repository.MentorRepository;
import com.ragapi.repository.QuestionEscalationRepository;
import com.ragapi.repository.UserRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.mongodb.core.MongoTemplate;

import java.util.Optional;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AdminDashboardServiceDeletionSafetyTest {

    @Mock UserRepository userRepository;
    @Mock MentorRepository mentorRepository;
    @Mock QuestionEscalationRepository escalationRepository;
    @Mock UserOwnedRecordCleanup cleanup;
    @Mock MongoTemplate mongoTemplate;

    @InjectMocks AdminDashboardService service;

    @Test
    void deleteUserCreatesAnInactiveTombstoneAndKeepsTheStableId() {
        User user = User.builder()
                .id("student-1")
                .email("student@example.com")
                .password("hash")
                .fullName("Bad test name")
                .studentCode("SE180001")
                .role("STUDENT")
                .isActive(true)
                .build();
        when(userRepository.findById("student-1")).thenReturn(Optional.of(user));
        when(mentorRepository.findById("student-1")).thenReturn(Optional.empty());
        when(mentorRepository.findByEmail("student@example.com")).thenReturn(Optional.empty());

        service.deleteUser("student-1", "admin-1");

        verify(cleanup).revokeAccessRecords(user);
        verify(userRepository, never()).delete(user);
        ArgumentCaptor<User> saved = ArgumentCaptor.forClass(User.class);
        verify(userRepository).save(saved.capture());
        assertThat(saved.getValue().getId()).isEqualTo("student-1");
        assertThat(saved.getValue().getIsActive()).isFalse();
        assertThat(saved.getValue().getFullName()).isEqualTo("Deleted user");
        assertThat(saved.getValue().getEmail()).isEqualTo("deleted+student-1@system.invalid");
        assertThat(saved.getValue().getStudentCode()).isEqualTo("SE180001");
        assertThat(saved.getValue().getDeletedAt()).isNotNull();
    }

    @Test
    void deletingAnOpenEscalationCancelsAndArchivesWithoutPhysicalDelete() {
        QuestionEscalation escalation = QuestionEscalation.builder()
                .id("ticket-1")
                .idempotencyKey("ticket-key")
                .status("OFFERED")
                .build();
        when(escalationRepository.findById("ticket-1")).thenReturn(Optional.of(escalation));

        service.archiveMentorEscalation("ticket-1", "admin-1");

        verify(escalationRepository, never()).delete(escalation);
        verify(escalationRepository).save(escalation);
        assertThat(escalation.getStatus()).isEqualTo("CANCELLED");
        assertThat(escalation.getCancelReason()).isEqualTo("ADMIN_ARCHIVED");
        assertThat(escalation.getIdempotencyKey()).isNull();
        assertThat(escalation.getHiddenFromAdminAt()).isNotNull();
        assertThat(escalation.getHiddenFromMentorInboxAt()).isNotNull();
    }

    @Test
    void adminTicketListUsesCurrentStudentIdentityAndHidesInvalidOwners() {
        User student = User.builder().id("student-1").email("current@example.com")
                .fullName("Current Student").role("STUDENT").isActive(true).build();
        User admin = User.builder().id("admin-1").email("admin@example.com")
                .fullName("System Admin").role("ADMIN").isActive(true).build();
        QuestionEscalation valid = QuestionEscalation.builder().id("valid")
                .userId("student-1").userName("ngu").userEmail("old@example.com").build();
        QuestionEscalation invalidAdminOwner = QuestionEscalation.builder().id("invalid")
                .userId("admin-1").userName("System Admin").build();
        QuestionEscalation orphan = QuestionEscalation.builder().id("orphan")
                .userId("missing-user").userName("removed test account").build();
        when(userRepository.findAll()).thenReturn(List.of(student, admin));
        when(escalationRepository.findAll()).thenReturn(List.of(valid, invalidAdminOwner, orphan));

        List<QuestionEscalation> result = service.filterMentorEscalations(
                null, null, null, null, null);

        assertThat(result).extracting(QuestionEscalation::getId).containsExactly("valid");
        assertThat(result.get(0).getUserName()).isEqualTo("Current Student");
        assertThat(result.get(0).getUserEmail()).isEqualTo("current@example.com");
    }

    @Test
    void activeChatCannotBeArchivedOutFromUnderLearningFlow() {
        QuestionEscalation escalation = QuestionEscalation.builder()
                .id("ticket-in-chat")
                .status("IN_CHAT")
                .chatRoomId("room-1")
                .build();
        when(escalationRepository.findById("ticket-in-chat")).thenReturn(Optional.of(escalation));

        assertThatThrownBy(() -> service.archiveMentorEscalation("ticket-in-chat", "admin-1"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("must be closed");
        verify(escalationRepository, never()).save(escalation);
        verify(escalationRepository, never()).delete(escalation);
    }
}
