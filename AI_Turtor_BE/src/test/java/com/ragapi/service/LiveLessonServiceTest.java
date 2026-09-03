package com.ragapi.service;

import com.ragapi.dto.CreateLiveLessonRequest;
import com.ragapi.dto.LiveLessonResponse;
import com.ragapi.entity.ClassSection;
import com.ragapi.entity.CourseEnrollment;
import com.ragapi.entity.LiveLesson;
import com.ragapi.repository.ClassSectionRepository;
import com.ragapi.repository.CourseEnrollmentRepository;
import com.ragapi.repository.LiveLessonChatMessageRepository;
import com.ragapi.repository.LiveLessonRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class LiveLessonServiceTest {

    @Mock
    private LiveLessonRepository lessonRepository;
    @Mock
    private LiveLessonChatMessageRepository chatRepository;
    @Mock
    private ClassSectionRepository classSectionRepository;
    @Mock
    private CourseEnrollmentRepository enrollmentRepository;
    @Mock
    private CourseRagService ragService;
    @Mock
    private RealtimeEventService realtimeEvents;

    @InjectMocks
    private LiveLessonService service;

    @Test
    void nextStatusWaitsForTeacherPlayback() {
        LiveLesson lesson = LiveLesson.builder()
                .status(LiveLessonService.STATUS_SCHEDULED)
                .startsAt(LocalDateTime.of(2026, 9, 3, 15, 0))
                .endsAt(LocalDateTime.of(2026, 9, 3, 16, 30))
                .build();

        assertThat(LiveLessonService.nextStatus(lesson, LocalDateTime.of(2026, 9, 3, 14, 59)))
                .isEqualTo(LiveLessonService.STATUS_SCHEDULED);
        assertThat(LiveLessonService.nextStatus(lesson, LocalDateTime.of(2026, 9, 3, 15, 0)))
                .isEqualTo(LiveLessonService.STATUS_SCHEDULED);
        lesson.setPlaybackStartedAt(LocalDateTime.of(2026, 9, 3, 15, 1));
        assertThat(LiveLessonService.nextStatus(lesson, LocalDateTime.of(2026, 9, 3, 15, 2)))
                .isEqualTo(LiveLessonService.STATUS_LIVE);
        assertThat(LiveLessonService.nextStatus(lesson, LocalDateTime.of(2026, 9, 3, 16, 30)))
                .isEqualTo(LiveLessonService.STATUS_ENDED);
    }

    @Test
    void notifiesStudentsTenMinutesBeforeStart() {
        LiveLesson lesson = LiveLesson.builder()
                .status(LiveLessonService.STATUS_SCHEDULED)
                .startsAt(LocalDateTime.of(2026, 9, 3, 15, 0))
                .endsAt(LocalDateTime.of(2026, 9, 3, 16, 30))
                .build();
        assertThat(LiveLessonService.isUpcomingSoon(lesson, LocalDateTime.of(2026, 9, 3, 14, 49))).isFalse();
        assertThat(LiveLessonService.isUpcomingSoon(lesson, LocalDateTime.of(2026, 9, 3, 14, 50))).isTrue();
        assertThat(LiveLessonService.isUpcomingSoon(lesson, LocalDateTime.of(2026, 9, 3, 15, 5))).isTrue();
        lesson.setPlaybackStartedAt(LocalDateTime.of(2026, 9, 3, 15, 0));
        assertThat(LiveLessonService.isUpcomingSoon(lesson, LocalDateTime.of(2026, 9, 3, 15, 5))).isFalse();
    }

    @Test
    void sharedClockPausesAndResumesFromTeacherPosition() {
        LiveLesson lesson = LiveLesson.builder()
                .status(LiveLessonService.STATUS_LIVE)
                .playbackStartedAt(LocalDateTime.of(2026, 9, 3, 20, 0))
                .playbackPaused(true)
                .playbackPositionSeconds(42d)
                .playbackClockAt(LocalDateTime.of(2026, 9, 3, 20, 1))
                .build();
        assertThat(LiveLessonService.currentPlaybackSeconds(lesson, LocalDateTime.of(2026, 9, 3, 20, 10)))
                .isEqualTo(42);
        lesson.setPlaybackPaused(false);
        assertThat(LiveLessonService.currentPlaybackSeconds(lesson, LocalDateTime.of(2026, 9, 3, 20, 1, 10)))
                .isEqualTo(52);
    }

    @Test
    void createRejectsTeacherWhoDoesNotOwnTheClass() {
        CreateLiveLessonRequest request = new CreateLiveLessonRequest();
        request.setCourseId("PRF301");
        request.setClassId("SE1840");
        request.setTopic("OOP");
        request.setYoutubeUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
        request.setStartsAt(LocalDateTime.now().plusHours(1));

        ClassSection section = new ClassSection();
        section.setTeacherId("other-teacher");
        when(classSectionRepository.findByCourseIdAndClassId("PRF301", "SE1840"))
                .thenReturn(Optional.of(section));

        assertThatThrownBy(() -> service.create(request, "teacher-1", "Thầy A"))
                .isInstanceOf(SecurityException.class);
    }

    @Test
    void createStoresYoutubeIdAndDefaultsDuration() {
        CreateLiveLessonRequest request = new CreateLiveLessonRequest();
        request.setCourseId("PRF301");
        request.setClassId("SE1840");
        request.setTopic("Lập trình hướng đối tượng");
        request.setYoutubeUrl("https://youtu.be/dQw4w9WgXcQ");
        LocalDateTime startsAt = LocalDateTime.now().plusDays(1).withHour(19).withMinute(30).withSecond(0).withNano(0);
        request.setStartsAt(startsAt);

        ClassSection section = new ClassSection();
        section.setTeacherId("teacher-1");
        section.setCourseName("Programming Fundamentals");
        section.setClassName("SE1840");
        when(classSectionRepository.findByCourseIdAndClassId("PRF301", "SE1840"))
                .thenReturn(Optional.of(section));
        when(lessonRepository.save(any(LiveLesson.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(enrollmentRepository.findByCourseIdAndClassId("PRF301", "SE1840"))
                .thenReturn(List.of(CourseEnrollment.builder().studentId("sv-1").build()));

        LiveLessonResponse response = service.create(request, "teacher-1", "Thầy A");

        ArgumentCaptor<LiveLesson> captor = ArgumentCaptor.forClass(LiveLesson.class);
        verify(lessonRepository).save(captor.capture());
        assertThat(captor.getValue().getYoutubeVideoId()).isEqualTo("dQw4w9WgXcQ");
        assertThat(captor.getValue().getEndsAt()).isEqualTo(startsAt.plusMinutes(90));
        assertThat(response.getEmbedUrl()).contains("dQw4w9WgXcQ");
        assertThat(response.getTopic()).isEqualTo("Lập trình hướng đối tượng");
        verify(realtimeEvents).publishToUsers(
                eq(List.of("sv-1")),
                eq("LIVE_LESSON_SCHEDULED"),
                eq("LIVE_LESSON"),
                anyString(),
                eq("SCHEDULED"),
                any()
        );
    }

    @Test
    void sendUpcomingRemindersNotifiesOnceTenMinutesBefore() {
        LiveLesson lesson = LiveLesson.builder()
                .id("lesson-1")
                .courseId("PRF301")
                .classId("SE1840")
                .status(LiveLessonService.STATUS_SCHEDULED)
                .startsAt(LocalDateTime.now().plusMinutes(5))
                .endsAt(LocalDateTime.now().plusHours(2))
                .build();
        when(lessonRepository.findByStatus(LiveLessonService.STATUS_SCHEDULED)).thenReturn(List.of(lesson));
        when(lessonRepository.save(any(LiveLesson.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(enrollmentRepository.findByCourseIdAndClassId("PRF301", "SE1840"))
                .thenReturn(List.of(CourseEnrollment.builder().studentId("sv-1").build()));

        service.sendUpcomingReminders();
        service.sendUpcomingReminders();

        assertThat(lesson.getStartReminderSentAt()).isNotNull();
        verify(realtimeEvents, times(1)).publishToUsers(
                eq(List.of("sv-1")),
                eq("LIVE_LESSON_STARTING"),
                eq("LIVE_LESSON"),
                eq("lesson-1"),
                eq("UPCOMING"),
                any()
        );
    }

    @Test
    void deleteAllowsEndedLessonsAfterPlayback() {
        LiveLesson lesson = LiveLesson.builder()
                .id("lesson-1")
                .teacherId("teacher-1")
                .status(LiveLessonService.STATUS_ENDED)
                .playbackStartedAt(LocalDateTime.now().minusHours(1))
                .endsAt(LocalDateTime.now().minusMinutes(5))
                .build();
        when(lessonRepository.findById("lesson-1")).thenReturn(Optional.of(lesson));

        service.delete("lesson-1", "teacher-1");

        verify(chatRepository).deleteByLessonId("lesson-1");
        verify(lessonRepository).delete(lesson);
    }

    @Test
    void deleteRejectsALessonThatIsStillPlaying() {
        LiveLesson lesson = LiveLesson.builder()
                .id("lesson-1")
                .teacherId("teacher-1")
                .status(LiveLessonService.STATUS_LIVE)
                .playbackStartedAt(LocalDateTime.now())
                .endsAt(LocalDateTime.now().plusHours(1))
                .build();
        when(lessonRepository.findById("lesson-1")).thenReturn(Optional.of(lesson));

        assertThatThrownBy(() -> service.delete("lesson-1", "teacher-1"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("đang phát");
    }
}
