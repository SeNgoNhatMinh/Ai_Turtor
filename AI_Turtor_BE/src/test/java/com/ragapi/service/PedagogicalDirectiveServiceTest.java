package com.ragapi.service;

import com.ragapi.dto.PedagogicalDirectiveRequest;
import com.ragapi.entity.PedagogicalDirective;
import com.ragapi.repository.PedagogicalDirectiveRepository;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

class PedagogicalDirectiveServiceTest {

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
