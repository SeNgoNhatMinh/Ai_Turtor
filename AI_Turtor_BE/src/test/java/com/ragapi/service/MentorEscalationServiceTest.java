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

    @InjectMocks MentorEscalationService service;

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
