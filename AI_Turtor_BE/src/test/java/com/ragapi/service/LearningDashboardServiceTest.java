package com.ragapi.service;

import com.ragapi.entity.QuestionEscalation;
import com.ragapi.repository.AssignmentRepository;
import com.ragapi.repository.AssignmentSubmissionRepository;
import com.ragapi.repository.ClassSectionRepository;
import com.ragapi.repository.CourseEnrollmentRepository;
import com.ragapi.repository.CourseMaterialRepository;
import com.ragapi.repository.ImprovePlanRepository;
import com.ragapi.repository.KnowledgeCandidateRepository;
import com.ragapi.repository.MentorRepository;
import com.ragapi.repository.QuestionEscalationRepository;
import com.ragapi.repository.StudentCourseMemoryRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class LearningDashboardServiceTest {

    @Mock CourseEnrollmentRepository enrollmentRepository;
    @Mock ClassSectionRepository classSectionRepository;
    @Mock AssignmentRepository assignmentRepository;
    @Mock AssignmentSubmissionRepository submissionRepository;
    @Mock CourseMaterialRepository materialRepository;
    @Mock StudentCourseMemoryRepository memoryRepository;
    @Mock QuestionEscalationRepository escalationRepository;
    @Mock KnowledgeCandidateRepository candidateRepository;
    @Mock ImprovePlanRepository improvePlanRepository;
    @Mock MentorRepository mentorRepository;

    @InjectMocks LearningDashboardService service;

    @Test
    void teacherInboxOnlyShowsEscalationsAssignedToThatTeacher() {
        QuestionEscalation assigned = QuestionEscalation.builder()
                .id("assigned")
                .courseId("PFP191")
                .classId("PFP191-01")
                .assignedMentorId("teacher-1")
                .status("IN_CHAT")
                .build();
        QuestionEscalation assignedElsewhere = QuestionEscalation.builder()
                .id("other")
                .courseId("PFP191")
                .classId("PFP191-01")
                .assignedMentorId("teacher-2")
                .status("IN_CHAT")
                .build();
        QuestionEscalation waitingForStudentSelection = QuestionEscalation.builder()
                .id("unassigned")
                .courseId("PFP191")
                .classId("PFP191-01")
                .status("OFFERED")
                .build();
        when(escalationRepository.findAll()).thenReturn(
                List.of(assigned, assignedElsewhere, waitingForStudentSelection));

        List<QuestionEscalation> visible = service.listTeacherEscalationInbox("teacher-1", null, null);

        assertThat(visible).extracting(QuestionEscalation::getId).containsExactly("assigned");
    }

    @Test
    void teacherInboxDoesNotShowSoftDeletedTicketButStudentRecordRemains() {
        QuestionEscalation visible = QuestionEscalation.builder()
                .id("visible")
                .assignedMentorId("teacher-1")
                .status("COMPLETED")
                .build();
        QuestionEscalation hidden = QuestionEscalation.builder()
                .id("hidden")
                .userId("student-1")
                .assignedMentorId("teacher-1")
                .status("COMPLETED")
                .hiddenFromMentorInboxAt(java.time.LocalDateTime.now())
                .build();
        when(escalationRepository.findAll()).thenReturn(List.of(visible, hidden));

        List<QuestionEscalation> inbox = service.listTeacherEscalationInbox("teacher-1", null, null);

        assertThat(inbox).extracting(QuestionEscalation::getId).containsExactly("visible");
        assertThat(hidden.getUserId()).isEqualTo("student-1");
    }
}
