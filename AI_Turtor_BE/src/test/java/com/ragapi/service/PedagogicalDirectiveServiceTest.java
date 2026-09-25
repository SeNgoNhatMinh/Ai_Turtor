package com.ragapi.service;

import com.ragapi.dto.PedagogicalDirectiveRequest;
import com.ragapi.entity.PedagogicalDirective;
import com.ragapi.repository.PedagogicalDirectiveRepository;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.time.LocalDateTime;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

class PedagogicalDirectiveServiceTest {

    @Test
    void defaultsToStandardUntilTeacherConfirmsSupport() {
        PedagogicalDirectiveRepository repository = mock(PedagogicalDirectiveRepository.class);
        PedagogicalDirectiveService service = new PedagogicalDirectiveService(repository, mock(ClassRosterService.class));

        when(repository.findByStudentIdAndCourseIdAndStatusOrderByPriorityDescUpdatedAtDesc(
                "student-1", "PRJ301", "CONFIRMED")).thenReturn(List.of());
        when(repository.findByCourseIdAndClassIdAndStatusOrderByPriorityDescUpdatedAtDesc(
                "PRJ301", "SE1840", "CONFIRMED")).thenReturn(List.of());

        assertThat(service.resolveSupportLevel("student-1", "PRJ301", "SE1840"))
                .isEqualTo("STANDARD");
        assertThat(service.hasActiveDirective("student-1", "PRJ301", "SE1840")).isFalse();
        assertThat(service.buildTutorContext("student-1", "PRJ301", "SE1840")).isBlank();
    }

    @Test
    void studentDirectiveOverridesClassDirectiveAndAppliesWithoutWrongAnswers() {
        PedagogicalDirectiveRepository repository = mock(PedagogicalDirectiveRepository.class);
        PedagogicalDirectiveService service = new PedagogicalDirectiveService(repository, mock(ClassRosterService.class));
        LocalDateTime now = LocalDateTime.now();
        PedagogicalDirective studentDirective = PedagogicalDirective.builder()
                .studentId("student-1")
                .courseId("PRJ301")
                .classId("SE1840")
                .scope("STUDENT")
                .status("CONFIRMED")
                .supportLevel("HIGH_SUPPORT")
                .instruction("Giải thích từng bước với ví dụ đơn giản.")
                .priority(10)
                .effectiveFrom(now.minusDays(1))
                .updatedAt(now)
                .build();
        PedagogicalDirective classDirective = PedagogicalDirective.builder()
                .courseId("PRJ301")
                .classId("SE1840")
                .scope("CLASS")
                .status("CONFIRMED")
                .supportLevel("CHALLENGE")
                .instruction("Dùng câu hỏi nâng cao.")
                .priority(100)
                .effectiveFrom(now.minusDays(1))
                .updatedAt(now)
                .build();

        when(repository.findByStudentIdAndCourseIdAndStatusOrderByPriorityDescUpdatedAtDesc(
                "student-1", "PRJ301", "CONFIRMED")).thenReturn(List.of(studentDirective));
        when(repository.findByCourseIdAndClassIdAndStatusOrderByPriorityDescUpdatedAtDesc(
                "PRJ301", "SE1840", "CONFIRMED")).thenReturn(List.of(classDirective));

        assertThat(service.resolveSupportLevel("student-1", "PRJ301", "SE1840"))
                .isEqualTo("HIGH_SUPPORT");
        assertThat(service.buildTutorContext("student-1", "PRJ301", "SE1840"))
                .contains("ACTIVE SUPPORT LEVEL: HIGH_SUPPORT")
                .contains("does not need to answer incorrectly first")
                .contains("Giải thích từng bước với ví dụ đơn giản.");
    }

    @Test
    void neverAppliesAnotherStudentsDirectiveFromTheSameClass() {
        PedagogicalDirectiveRepository repository = mock(PedagogicalDirectiveRepository.class);
        PedagogicalDirectiveService service = new PedagogicalDirectiveService(repository, mock(ClassRosterService.class));
        PedagogicalDirective otherStudent = PedagogicalDirective.builder()
                .studentId("student-2")
                .courseId("PRJ301")
                .classId("SE1840")
                .scope("STUDENT")
                .status("CONFIRMED")
                .supportLevel("HIGH_SUPPORT")
                .instruction("Chỉ dẫn riêng cho sinh viên 2")
                .priority(100)
                .effectiveFrom(LocalDateTime.now().minusDays(1))
                .updatedAt(LocalDateTime.now())
                .build();

        when(repository.findByStudentIdAndCourseIdAndStatusOrderByPriorityDescUpdatedAtDesc(
                "student-1", "PRJ301", "CONFIRMED")).thenReturn(List.of());
        when(repository.findByCourseIdAndClassIdAndStatusOrderByPriorityDescUpdatedAtDesc(
                "PRJ301", "SE1840", "CONFIRMED")).thenReturn(List.of(otherStudent));

        assertThat(service.resolveSupportLevel("student-1", "PRJ301", "SE1840"))
                .isEqualTo("STANDARD");
        assertThat(service.buildTutorContext("student-1", "PRJ301", "SE1840")).isBlank();
    }

    @Test
    void onlyConfirmedDirectiveIsExposedToTutorContext() {
        PedagogicalDirectiveRepository repository = mock(PedagogicalDirectiveRepository.class);
        when(repository.save(any())).thenAnswer(invocation -> invocation.getArgument(0));
        PedagogicalDirectiveService service = new PedagogicalDirectiveService(repository, mock(ClassRosterService.class));

        PedagogicalDirectiveRequest request = new PedagogicalDirectiveRequest();
        request.setStudentId("student-1");
        request.setCourseId("PRJ301");
        request.setClassId("SE1840");
        request.setInstruction("Giải thích từng bước và dùng ví dụ đơn giản.");

        PedagogicalDirective draft = service.createDraft(request, "teacher-1", "Teacher");
        assertThat(draft.getStatus()).isEqualTo("DRAFT");
        assertThat(draft.getSupportLevel()).isEqualTo("HIGH_SUPPORT");

        when(repository.findByStudentIdAndCourseIdAndStatusOrderByPriorityDescUpdatedAtDesc(
                "student-1", "PRJ301", "CONFIRMED")).thenReturn(List.of());
        when(repository.findByCourseIdAndClassIdAndStatusOrderByPriorityDescUpdatedAtDesc(
                "PRJ301", "SE1840", "CONFIRMED")).thenReturn(List.of());
        assertThat(service.buildTutorContext("student-1", "PRJ301", "SE1840")).isBlank();

        when(repository.findById(draft.getId())).thenReturn(java.util.Optional.of(draft));
        service.confirm(draft.getId(), "teacher-1");
        when(repository.findByStudentIdAndCourseIdAndStatusOrderByPriorityDescUpdatedAtDesc(
                "student-1", "PRJ301", "CONFIRMED")).thenReturn(List.of(draft));

        assertThat(service.buildTutorContext("student-1", "PRJ301", "SE1840"))
                .contains("Giải thích từng bước");
        verify(repository, atLeast(2)).save(any(PedagogicalDirective.class));
    }
}
