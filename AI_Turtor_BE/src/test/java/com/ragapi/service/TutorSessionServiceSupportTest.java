package com.ragapi.service;

import com.ragapi.dto.AiConversationSummary;
import com.ragapi.dto.CourseCurriculumOverview;
import com.ragapi.dto.OpenTutorSessionRequest;
import com.ragapi.dto.UpdateTutorSessionRequest;
import com.ragapi.entity.StudentCourseMemory;
import com.ragapi.entity.TutorSession;
import com.ragapi.repository.AiMessageRepository;
import com.ragapi.repository.StudentCourseMemoryRepository;
import com.ragapi.repository.TutorSessionRepository;
import com.ragapi.repository.TutorSessionSummaryRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class TutorSessionServiceSupportTest {

    @Mock TutorSessionRepository sessionRepository;
    @Mock TutorSessionSummaryRepository summaryRepository;
    @Mock StudentCourseMemoryRepository memoryRepository;
    @Mock AiMessageRepository messageRepository;
    @Mock AiConversationService conversationService;
    @Mock ChapterOutlineService chapterOutlineService;
    @Mock CourseCurriculumOverviewService curriculumOverviewService;
    @Mock RealtimeEventService realtimeEvents;
    @Mock ClassRosterService classRosterService;
    @Mock PedagogicalDirectiveService directiveService;

    @InjectMocks TutorSessionService service;

    @Test
    void weakTopicsDoNotPromoteSupportWithoutTeacherDirective() {
        OpenTutorSessionRequest request = new OpenTutorSessionRequest();
        request.setStudentId("student-1");
        request.setCourseId("PRJ301");
        request.setClassId("SE1840");

        StudentCourseMemory memory = new StudentCourseMemory();
        memory.setWeakTopics(List.of("Servlet lifecycle"));
        when(sessionRepository.findFirstByStudentIdAndCourseIdAndStatusOrderByUpdatedAtDesc(
                "student-1", "PRJ301", "ACTIVE")).thenReturn(Optional.empty());
        when(memoryRepository.findByStudentIdAndCourseId("student-1", "PRJ301"))
                .thenReturn(Optional.of(memory));
        when(chapterOutlineService.suggestChapters("PRJ301")).thenReturn(List.of());
        when(curriculumOverviewService.forCourse("PRJ301"))
                .thenReturn(CourseCurriculumOverview.empty("PRJ301"));
        when(directiveService.resolveSupportLevel("student-1", "PRJ301", "SE1840"))
                .thenReturn("STANDARD");
        when(sessionRepository.save(any(TutorSession.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(conversationService.createTutorConversation(
                eq("student-1"), eq("PRJ301"), eq("SE1840"), any()))
                .thenReturn(AiConversationSummary.builder().conversationId("conversation-1").build());

        Map<String, Object> response = service.openOrResume(request);

        TutorSession session = (TutorSession) response.get("session");
        assertThat(session.getSupportLevel()).isEqualTo("STANDARD");
        verify(directiveService).resolveSupportLevel("student-1", "PRJ301", "SE1840");
    }

    @Test
    void studentSessionCannotOverrideTeacherControlledSupportLevel() {
        TutorSession session = TutorSession.builder()
                .id("session-1")
                .studentId("student-1")
                .courseId("PRJ301")
                .classId("SE1840")
                .supportLevel("STANDARD")
                .build();
        when(sessionRepository.findById("session-1")).thenReturn(Optional.of(session));
        UpdateTutorSessionRequest request = new UpdateTutorSessionRequest();
        request.setSupportLevel("HIGH_SUPPORT");

        assertThatThrownBy(() -> service.update("session-1", request))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("teacher-controlled");
        assertThat(session.getSupportLevel()).isEqualTo("STANDARD");
    }
}
