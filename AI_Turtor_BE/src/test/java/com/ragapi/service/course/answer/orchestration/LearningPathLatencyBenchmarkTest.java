package com.ragapi.service.course.answer.orchestration;

import com.ragapi.dto.CourseRagAnswer;
import com.ragapi.service.course.answer.grounding.CourseAnswerEvidenceService;
import com.ragapi.service.course.model.CourseAnswerRequest;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyMap;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class LearningPathLatencyBenchmarkTest {

    @Test
    void learningPathSkipsTutorGeneration() throws Exception {
        CourseAnswerPreparationService preparationService = mock(CourseAnswerPreparationService.class);
        CourseAnswerGenerationStageService generationStageService = mock(CourseAnswerGenerationStageService.class);
        CourseAnswerEvidenceService evidenceService = mock(CourseAnswerEvidenceService.class);
        CourseAnswerPipelineService pipeline = new CourseAnswerPipelineService(
                preparationService,
                mock(CourseAnswerResultService.class),
                mock(CourseAnswerCacheStageService.class),
                generationStageService,
                evidenceService
        );
        CourseAnswerRequest request = CourseAnswerRequest.builder()
                .question("Hôm nay mình muốn học về kết nối cơ sở dữ liệu JDBC")
                .courseId("PRJ301")
                .teachingMode("LEARNING_PATH")
                .build();
        CourseAnswerPreparation prepared = new CourseAnswerPreparation(
                request,
                System.nanoTime(),
                request.question(),
                "PRJ301",
                request.question(),
                List.of(),
                "JDBC connects Java applications to a database.",
                Map.of(),
                "COURSE_MATERIAL",
                List.of("Main Material"),
                0.9,
                true,
                true,
                false,
                null
        );
        when(preparationService.prepare(any(), anyLong())).thenReturn(prepared);
        when(evidenceService.buildSourceEvidence(anyList(), anyString(), anyMap(), anyString()))
                .thenReturn(List.of());
        when(evidenceService.buildSourceLabels(anyList(), anyMap()))
                .thenReturn(List.of("Main Material"));

        long started = System.nanoTime();
        CourseRagAnswer answer = pipeline.retrieveLearningPath(request);
        long elapsedMs = (System.nanoTime() - started) / 1_000_000L;

        System.out.println("LEARNING_PATH retrieve elapsedMs=" + elapsedMs);
        assertTrue(elapsedMs < 1_000, "learning path retrieval took " + elapsedMs + "ms");
        assertFalse(answer.getEscalationRecommended());
        verify(generationStageService, never()).generate(any());
    }
}
