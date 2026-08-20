package com.ragapi.service;

import com.ragapi.dto.SeniorTutorAnswerCacheUpdateRequest;
import com.ragapi.entity.AiAnswerReview;
import com.ragapi.entity.CanonicalTutorAnswer;
import com.ragapi.repository.CanonicalTutorAnswerRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class TutorAnswerCacheSeniorServiceTest {

    @Mock
    private CanonicalTutorAnswerRepository repository;

    @Mock
    private TutorCacheHitAuditService auditService;

    @Mock
    private CanonicalTutorAnswerCacheService cacheService;

    @InjectMocks
    private TutorAnswerCacheSeniorService service;

    private CanonicalTutorAnswer activeEntry;

    @BeforeEach
    void setUp() {
        activeEntry = CanonicalTutorAnswer.builder()
                .id("cache-1")
                .courseId("CEA201")
                .classId("")
                .mode("RAG")
                .question("Servlet là gì?")
                .answer("Servlet là thành phần xử lý request.")
                .confidence(0.82)
                .groundingType("COURSE_MATERIAL")
                .reviewStatus("ACTIVE")
                .createdAt(LocalDateTime.now())
                .expiresAt(LocalDateTime.now().plusDays(7))
                .build();
    }

    @Test
    void disable_marksEntryAsDisabled() {
        when(repository.findById("cache-1")).thenReturn(Optional.of(activeEntry));
        when(repository.save(any(CanonicalTutorAnswer.class))).thenAnswer(invocation -> invocation.getArgument(0));

        SeniorTutorAnswerCacheUpdateRequest request = seniorRequest();
        var view = service.disable("cache-1", request);

        assertThat(view.getReviewStatus()).isEqualTo("DISABLED");
        assertThat(TutorAnswerCacheSeniorService.isUsableForStudents(activeEntry)).isFalse();
        verify(cacheService).evictExactRagAnswer("cache-1");
    }

    @Test
    void correct_replacesAnswerAndKeepsOriginal() {
        when(repository.findById("cache-1")).thenReturn(Optional.of(activeEntry));
        when(repository.save(any(CanonicalTutorAnswer.class))).thenAnswer(invocation -> invocation.getArgument(0));

        SeniorTutorAnswerCacheUpdateRequest request = seniorRequest();
        request.setCorrectedAnswer("Servlet là lớp Java chạy trên server để xử lý HTTP request theo tài liệu môn.");

        var view = service.correct("cache-1", request);

        assertThat(view.getReviewStatus()).isEqualTo("SENIOR_CORRECTED");
        assertThat(view.getOriginalAnswer()).contains("Servlet");
        assertThat(view.getAnswer()).contains("HTTP request");
        verify(cacheService).evictExactRagAnswer("cache-1");
    }

    @Test
    void applySeniorReviewResolution_disablesMatchingCacheOnReject() {
        AiAnswerReview review = AiAnswerReview.builder()
                .id("review-1")
                .courseId("CEA201")
                .classId("")
                .mode("RAG")
                .question("Servlet là gì?")
                .answer("Servlet là thành phần xử lý request.")
                .build();
        when(repository.findByCourseIdAndModeOrderByCreatedAtDesc("CEA201", "RAG"))
                .thenReturn(List.of(activeEntry));
        when(repository.save(any(CanonicalTutorAnswer.class))).thenAnswer(invocation -> invocation.getArgument(0));

        service.applySeniorReviewResolution(
                review,
                "REJECT_FEEDBACK",
                null,
                "Answer is inaccurate",
                "senior-1",
                "Senior Mentor"
        );

        assertThat(activeEntry.getReviewStatus()).isEqualTo("DISABLED");
        verify(repository).save(activeEntry);
        verify(cacheService).evictExactRagAnswer("cache-1");
    }

    @Test
    void delete_removesPersistedAndInMemoryEntry() {
        when(repository.existsById("cache-1")).thenReturn(true);

        service.delete("cache-1", seniorRequest());

        verify(repository).deleteById("cache-1");
        verify(cacheService).evictExactRagAnswer("cache-1");
    }

    @Test
    void rejectNonSeniorRole() {
        SeniorTutorAnswerCacheUpdateRequest request = new SeniorTutorAnswerCacheUpdateRequest();
        request.setSeniorReviewerId("teacher-1");
        request.setReviewerRole("TEACHER");

        assertThatThrownBy(() -> service.disable("cache-1", request))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("SENIOR_MENTOR");
    }

    private SeniorTutorAnswerCacheUpdateRequest seniorRequest() {
        SeniorTutorAnswerCacheUpdateRequest request = new SeniorTutorAnswerCacheUpdateRequest();
        request.setSeniorReviewerId("senior-1");
        request.setSeniorReviewerName("Senior Mentor");
        request.setReviewerRole("SENIOR_MENTOR");
        request.setNotes("Reviewed");
        return request;
    }
}
