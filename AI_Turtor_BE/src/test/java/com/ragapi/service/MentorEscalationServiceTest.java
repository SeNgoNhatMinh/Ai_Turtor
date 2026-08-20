package com.ragapi.service;

import com.ragapi.entity.QuestionEscalation;
import com.ragapi.repository.ChatRoomRepository;
import com.ragapi.repository.MentorRepository;
import com.ragapi.repository.QuestionEscalationRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class MentorEscalationServiceTest {

    @Mock QuestionEscalationRepository escalationRepository;
    @Mock MentorRepository mentorRepository;
    @Mock ChatRoomRepository chatRoomRepository;
    @Mock MentorMatchingService matchingService;
    @Mock AcademicRoutingService academicRoutingService;

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
}
