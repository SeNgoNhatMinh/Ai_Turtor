package com.ragapi.service.course.answer.orchestration;

import com.ragapi.dto.CourseRagAnswer;
import com.ragapi.service.CanonicalTutorAnswerCacheService;
import com.ragapi.service.course.answer.generation.CourseAnswerGenerationService;
import com.ragapi.service.course.answer.generation.CourseAnswerPromptService;
import com.ragapi.service.course.answer.grounding.CourseAnswerEvidenceService;
import com.ragapi.service.course.model.CourseAnswerRequest;
import com.ragapi.util.StudentFacingMessages;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class CourseAnswerGenerationStageServiceTest {

    @Test
    void retriesModelInsufficientMaterialClaimAfterGroundingAlreadyPassed() {
        CourseAnswerGenerationService generationService = mock(CourseAnswerGenerationService.class);
        CourseAnswerPromptService promptService = mock(CourseAnswerPromptService.class);
        CourseAnswerEvidenceService evidenceService = mock(CourseAnswerEvidenceService.class);
        CanonicalTutorAnswerCacheService cacheService = mock(CanonicalTutorAnswerCacheService.class);
        CourseAnswerResultService resultService = mock(CourseAnswerResultService.class);
        CourseAnswerGenerationStageService service = new CourseAnswerGenerationStageService(
                generationService, promptService, evidenceService, cacheService, resultService);

        CourseAnswerRequest request = CourseAnswerRequest.builder()
                .question("Giải thích lệnh continue trong vòng lặp while")
                .courseId("PFP191")
                .classId("PFP191-01")
                .teachingMode("EXPLAIN_CONCEPT")
                .build();
        CourseAnswerPreparation prepared = new CourseAnswerPreparation(
                request,
                System.nanoTime(),
                request.question(),
                request.courseId(),
                request.question(),
                List.of(),
                "Lệnh continue bỏ qua phần còn lại của lần lặp hiện tại.",
                Map.of(),
                "COURSE_MATERIAL",
                List.of("Python material"),
                0.92,
                true,
                false,
                false,
                null
        );

        when(promptService.buildPrompt(
                anyString(), anyString(), eq(List.of("Python material")), anyString(), anyString(),
                anyBoolean(), eq(null), eq(null), eq("EXPLAIN_CONCEPT"), anyBoolean()))
                .thenReturn("prompt");
        when(generationService.generateGroundedAnswer(
                anyString(), eq(request.question()), eq("EXPLAIN_CONCEPT"), anyString(), eq(null)))
                .thenReturn("Tài liệu hiện có không đủ nội dung để trả lời.");
        when(generationService.generateGroundedQualityFallbackAnswer(
                anyString(), eq(request.question()), eq("EXPLAIN_CONCEPT"), anyString(), eq(null)))
                .thenReturn("Lệnh continue bỏ qua phần còn lại của lần lặp hiện tại và chuyển sang lần lặp kế tiếp.");
        when(evidenceService.selectAnswerEvidenceChunks(List.of(), request.question(),
                "Lệnh continue bỏ qua phần còn lại của lần lặp hiện tại và chuyển sang lần lặp kế tiếp."))
                .thenReturn(List.of());
        when(evidenceService.buildSourceLabels(eq(List.of()), eq(Map.of()))).thenReturn(List.of());
        when(evidenceService.buildSourceEvidence(eq(List.of()), eq("PFP191"), eq(Map.of()), anyString()))
                .thenReturn(List.of());

        CourseRagAnswer result = service.generate(prepared);

        assertEquals(false, result.getEscalationRecommended());
        assertEquals("Lệnh continue bỏ qua phần còn lại của lần lặp hiện tại và chuyển sang lần lặp kế tiếp.",
                result.getAnswer());
        verify(generationService, times(1)).generateGroundedAnswer(
                anyString(), eq(request.question()), eq("EXPLAIN_CONCEPT"), anyString(), eq(null));
        verify(generationService, times(1)).generateGroundedQualityFallbackAnswer(
                anyString(), eq(request.question()), eq("EXPLAIN_CONCEPT"), anyString(), eq(null));
    }

    @Test
    void lessonTeachRetriesAndDoesNotPersistAResponseWithoutExplanationAndQuiz() {
        CourseAnswerGenerationService generationService = mock(CourseAnswerGenerationService.class);
        CourseAnswerPromptService promptService = mock(CourseAnswerPromptService.class);
        CourseAnswerEvidenceService evidenceService = mock(CourseAnswerEvidenceService.class);
        CanonicalTutorAnswerCacheService cacheService = mock(CanonicalTutorAnswerCacheService.class);
        CourseAnswerResultService resultService = mock(CourseAnswerResultService.class);
        CourseAnswerGenerationStageService service = new CourseAnswerGenerationStageService(
                generationService, promptService, evidenceService, cacheService, resultService);

        CourseAnswerRequest request = CourseAnswerRequest.builder()
                .question("Bắt đầu bài 3: Cấu trúc điều khiển")
                .courseId("PFP191")
                .classId("PFP191-01")
                .teachingMode("LESSON_TEACH")
                .build();
        CourseAnswerPreparation prepared = new CourseAnswerPreparation(
                request,
                System.nanoTime(),
                request.question(),
                request.courseId(),
                request.question(),
                List.of(),
                "if, while và for là các cấu trúc điều khiển trong Python.",
                Map.of(),
                "COURSE_MATERIAL",
                List.of("Main Material"),
                0.9,
                true,
                false,
                false,
                null
        );
        CourseRagAnswer unavailable = CourseRagAnswer.builder()
                .answer(StudentFacingMessages.GENERATION_BUSY)
                .build();

        when(promptService.buildPrompt(
                anyString(), anyString(), eq(List.of("Main Material")), anyString(), anyString(),
                anyBoolean(), eq(null), eq(null), eq("LESSON_TEACH"), anyBoolean()))
                .thenReturn("prompt");
        when(generationService.generateGroundedAnswer(
                anyString(), eq(request.question()), eq("LESSON_TEACH"), anyString(), eq(null)))
                .thenReturn("## Giải thích\nNội dung quá ngắn.");
        when(generationService.generateGroundedQualityFallbackAnswer(
                anyString(), eq(request.question()), eq("LESSON_TEACH"), anyString(), eq(null)))
                .thenReturn("## Giải thích\nNội dung vẫn quá ngắn.");
        when(resultService.softUnavailable(StudentFacingMessages.GENERATION_BUSY, List.of("Main Material")))
                .thenReturn(unavailable);

        CourseRagAnswer result = service.generate(prepared);

        assertSame(unavailable, result);
        verify(generationService, times(1)).generateGroundedAnswer(
                anyString(), eq(request.question()), eq("LESSON_TEACH"), anyString(), eq(null));
        verify(generationService, times(1)).generateGroundedQualityFallbackAnswer(
                anyString(), eq(request.question()), eq("LESSON_TEACH"), anyString(), eq(null));
    }
}
