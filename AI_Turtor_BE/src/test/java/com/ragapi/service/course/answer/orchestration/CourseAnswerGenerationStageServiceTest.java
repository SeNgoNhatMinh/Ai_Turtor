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
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class CourseAnswerGenerationStageServiceTest {

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
                eq("prompt"), eq(request.question()), eq("LESSON_TEACH"), anyString(), eq(null)))
                .thenReturn("## Giải thích\nNội dung quá ngắn.");
        when(resultService.softUnavailable(StudentFacingMessages.GENERATION_BUSY, List.of("Main Material")))
                .thenReturn(unavailable);

        CourseRagAnswer result = service.generate(prepared);

        assertSame(unavailable, result);
        verify(generationService, times(2)).generateGroundedAnswer(
                eq("prompt"), eq(request.question()), eq("LESSON_TEACH"), anyString(), eq(null));
    }
}
