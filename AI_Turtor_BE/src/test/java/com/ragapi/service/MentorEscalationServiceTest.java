package com.ragapi.service;

import com.ragapi.entity.ChatRoom;
import com.ragapi.entity.ClassSection;
import com.ragapi.entity.Mentor;
import com.ragapi.entity.QuestionEscalation;
import com.ragapi.repository.ChatRoomRepository;
import com.ragapi.repository.ClassSectionRepository;
import com.ragapi.repository.MentorRepository;
import com.ragapi.repository.QuestionEscalationRepository;
import com.ragapi.service.presence.TeacherPresenceQueryService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class MentorEscalationServiceTest {

    @Mock QuestionEscalationRepository escalationRepository;
    @Mock MentorRepository mentorRepository;
    @Mock ChatRoomRepository chatRoomRepository;
    @Mock MentorMatchingService matchingService;
    @Mock AcademicRoutingService academicRoutingService;
    @Mock ClassSectionRepository classSectionRepository;
    @Mock TeacherPresenceQueryService teacherPresenceQueryService;
    @Mock RealtimeEventService realtimeEventService;
    @Mock UserNotificationService notifications;

    @InjectMocks MentorEscalationService service;

    @Test
    void createEscalationReusesExistingTicketForTheSameLogicalQuestion() {
        QuestionEscalation existing = QuestionEscalation.builder()
                .id("escalation-existing")
                .userId("student-owner")
                .courseId("PRJ301")
                .classId("SE1832")
                .conversationId("conversation-1")
                .originalQuestion("PyTorch Ä‘Æ°á»£c phÃ¡t triá»ƒn bá»Ÿi ai?")
                .status("PENDING_OFFER")
                .build();
        when(escalationRepository.findByIdempotencyKey(anyString())).thenReturn(Optional.of(existing));

        QuestionEscalation result = service.createQuestionEscalation(
                "student-owner",
                "student@example.com",
                "Student",
                "  PyTorch  Ä‘Æ°á»£c phÃ¡t triá»ƒn bá»Ÿi ai? ",
                "AI response",
                "PRJ301",
                "SE1832",
                "conversation-1"
        );

        assertThat(result.getId()).isEqualTo("escalation-existing");
        verify(escalationRepository, never()).save(any(QuestionEscalation.class));
    }

    @Test
    void onlyStudentOwnerCanRequestMentorSuggestions() {
        QuestionEscalation escalation = QuestionEscalation.builder()
                .id("escalation-1")
                .userId("student-owner")
                .build();
        when(escalationRepository.findById("escalation-1")).thenReturn(Optional.of(escalation));

        assertThatThrownBy(() -> service.offerMentorHelp("escalation-1", "student-other"))
                .isInstanceOf(SecurityException.class)
                .hasMessageContaining("student who created");
    }

    @Test
    void offerMarksTeacherOfflineWithoutRemovingThemFromChoices() {
        QuestionEscalation escalation = classTeacherEscalation();
        ClassSection classSection = classSection();
        Mentor teacher = teacher();
        when(escalationRepository.findById("escalation-1")).thenReturn(Optional.of(escalation));
        when(academicRoutingService.resolveRoute("student-owner", "PRJ301", "SE1832"))
                .thenReturn(new AcademicRoutingService.EscalationRoute(true, classSection, "active class"));
        when(classSectionRepository.findByCourseId("PRJ301")).thenReturn(List.of(classSection));
        when(mentorRepository.findById("teacher-1")).thenReturn(Optional.of(teacher));
        when(teacherPresenceQueryService.isOnline("teacher-1")).thenReturn(false);
        when(escalationRepository.save(any(QuestionEscalation.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

        var offer = service.offerMentorHelp("escalation-1", "student-owner");

        assertThat(offer.getSuggestedMentors()).hasSize(1);
        assertThat(offer.getSuggestedMentors().get(0).getOnline()).isFalse();
    }

    @Test
    void studentCanSelectOfflineTeacherAndKeepTicketAssignedToThem() {
        QuestionEscalation escalation = classTeacherEscalation();
        escalation.setStatus("OFFERED");
        escalation.setEscalationRoute("CLASS_TEACHER");
        ClassSection classSection = classSection();
        Mentor teacher = teacher();
        when(escalationRepository.findById("escalation-1")).thenReturn(Optional.of(escalation));
        when(classSectionRepository.findByCourseId("PRJ301")).thenReturn(List.of(classSection));
        when(mentorRepository.findById("teacher-1")).thenReturn(Optional.of(teacher));
        when(chatRoomRepository.save(any(ChatRoom.class))).thenAnswer(invocation -> {
            ChatRoom room = invocation.getArgument(0);
            room.setId("room-1");
            return room;
        });
        when(escalationRepository.save(any(QuestionEscalation.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

        var selection = service.selectMentor("escalation-1", "student-owner", "teacher-1");

        assertThat(selection.getChatRoomId()).isEqualTo("room-1");
        assertThat(escalation.getAssignedMentorId()).isEqualTo("teacher-1");
        assertThat(escalation.getStatus()).isEqualTo("IN_CHAT");
    }

    @Test
    void selectMentorReusesRoomAlreadyLinkedToTheEscalation() {
        QuestionEscalation escalation = classTeacherEscalation();
        ChatRoom existingRoom = ChatRoom.builder()
                .id("room-existing")
                .questionEscalationId("escalation-1")
                .mentorId("teacher-1")
                .mentorName("Teacher A")
                .mentorEmail("teacher@example.com")
                .build();
        when(escalationRepository.findById("escalation-1")).thenReturn(Optional.of(escalation));
        when(chatRoomRepository.findFirstByQuestionEscalationIdOrderByCreatedAtAsc("escalation-1"))
                .thenReturn(Optional.of(existingRoom));
        when(escalationRepository.save(any(QuestionEscalation.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

        var selection = service.selectMentor("escalation-1", "student-owner", "teacher-1");

        assertThat(selection.getChatRoomId()).isEqualTo("room-existing");
        assertThat(escalation.getChatRoomId()).isEqualTo("room-existing");
        verify(chatRoomRepository, never()).save(any(ChatRoom.class));
    }

    @Test
    void historyCollapsesLegacyDuplicateTicketsAndKeepsTheUsableChat() {
        QuestionEscalation usable = classTeacherEscalation();
        usable.setId("escalation-usable");
        usable.setConversationId("conversation-1");
        usable.setChatRoomId("room-1");
        usable.setStatus("IN_CHAT");
        usable.setUpdatedAt(java.time.LocalDateTime.now().minusMinutes(1));
        QuestionEscalation orphan = classTeacherEscalation();
        orphan.setId("escalation-orphan");
        orphan.setConversationId("conversation-1");
        orphan.setStatus("PENDING_OFFER");
        orphan.setUpdatedAt(java.time.LocalDateTime.now());
        when(escalationRepository.findByUserId("student-owner"))
                .thenReturn(List.of(usable, orphan));

        List<QuestionEscalation> history = service.getUserMentorEscalationHistory("student-owner");

        assertThat(history).hasSize(1);
        assertThat(history.get(0).getId()).isEqualTo("escalation-usable");
        assertThat(history.get(0).getChatRoomId()).isEqualTo("room-1");
    }

    @Test
    void historyKeepsResolvedTicketsWhenTheQuestionWasAskedAgain() {
        QuestionEscalation older = classTeacherEscalation();
        older.setId("escalation-old");
        older.setConversationId("conversation-1");
        older.setStatus("RESOLVED_INDEXED");
        older.setUpdatedAt(java.time.LocalDateTime.now().minusDays(1));
        QuestionEscalation newer = classTeacherEscalation();
        newer.setId("escalation-new");
        newer.setConversationId("conversation-1");
        newer.setStatus("RESOLVED_INDEXED");
        newer.setUpdatedAt(java.time.LocalDateTime.now());
        when(escalationRepository.findByUserId("student-owner"))
                .thenReturn(List.of(older, newer));

        List<QuestionEscalation> history = service.getUserMentorEscalationHistory("student-owner");

        assertThat(history).extracting(QuestionEscalation::getId)
                .containsExactly("escalation-new", "escalation-old");
    }

    private QuestionEscalation classTeacherEscalation() {
        return QuestionEscalation.builder()
                .id("escalation-1")
                .userId("student-owner")
                .userName("Student")
                .userEmail("student@example.com")
                .courseId("PRJ301")
                .classId("SE1832")
                .originalQuestion("Interpreter và compiler khác nhau thế nào?")
                .build();
    }

    private ClassSection classSection() {
        return ClassSection.builder()
                .courseId("PRJ301")
                .classId("SE1832")
                .teacherId("teacher-1")
                .status("ACTIVE")
                .build();
    }

    private Mentor teacher() {
        return Mentor.builder()
                .id("teacher-1")
                .mentorName("Teacher A")
                .email("teacher@example.com")
                .isActive(true)
                .build();
    }
}
