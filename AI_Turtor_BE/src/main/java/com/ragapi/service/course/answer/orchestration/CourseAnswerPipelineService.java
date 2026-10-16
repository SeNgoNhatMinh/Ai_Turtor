package com.ragapi.service.course.answer.orchestration;

import com.ragapi.dto.CourseRagAnswer;
import com.ragapi.dto.RagSourceEvidence;
import com.ragapi.service.course.answer.grounding.CourseAnswerEvidenceService;
import com.ragapi.service.course.model.CourseAnswerRequest;
import com.ragapi.service.course.model.RetrievedCourseChunk;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.util.List;
import java.util.Optional;
import org.slf4j.MDC;
import com.ragapi.service.aiworker.AiWorkerTraceService;

/** Coordinates the answer stages while keeping each stage independently replaceable. */
@Service
@RequiredArgsConstructor
public class CourseAnswerPipelineService {

    private final CourseAnswerPreparationService preparationService;
    private final CourseAnswerResultService resultService;
    private final CourseAnswerCacheStageService cacheStageService;
    private final CourseAnswerGenerationStageService generationStageService;
    private final CourseAnswerEvidenceService evidenceService;
    private final AiWorkerTraceService traceService;

    /**
     * A learning path only needs retrieved chapters. Generating a full tutor
     * answer here was discarded afterwards and made the turn take minutes.
     */
    public CourseRagAnswer retrieveLearningPath(CourseAnswerRequest request) throws IOException {
        CourseAnswerPreparation prepared = preparationService.prepare(request, System.nanoTime(), false);
        if (prepared.hasImmediateAnswer()) {
            return prepared.immediateAnswer();
        }
        List<RetrievedCourseChunk> chunks = prepared.chunks() == null ? List.of() : prepared.chunks();
        List<RagSourceEvidence> evidence = evidenceService.buildSourceEvidence(
                chunks, prepared.courseId(), prepared.materialsById(), prepared.question());
        return CourseRagAnswer.builder()
                .answer("")
                .confidence(prepared.confidence())
                .sources(evidenceService.buildSourceLabels(chunks, prepared.materialsById()))
                .sourceEvidence(evidence)
                .groundingType(prepared.groundingType() == null ? "COURSE_MATERIAL" : prepared.groundingType())
                .escalationRecommended(false)
                .build();
    }

    private void recordDownstreamWorkersSkipped(String traceId, String reason) {
        traceService.record(traceId, "worker-2", "Worker 2 · Quiz Generator", "GENERATE_QUIZ", "SKIPPED", null, null, reason);
        traceService.record(traceId, "worker-3", "Worker 3 · Deep Study Titles", "GENERATE_DEEP_STUDY", "SKIPPED", null, null, reason);
    }
    public CourseRagAnswer answer(CourseAnswerRequest request) throws IOException {
        String previousTraceId = MDC.get("aiTraceId");
        String traceId = previousTraceId == null || previousTraceId.isBlank() ? traceService.newTraceId() : previousTraceId;
        MDC.put("aiTraceId", traceId);
        traceService.record(traceId, "worker-1", "Answer Generation", "REQUEST", "STARTED", null, 0L, "Course answer request started");
        long startedNanos = System.nanoTime();
        try {
            return answerWithTrace(request, startedNanos, traceId);
        } finally {
            if (previousTraceId == null) MDC.remove("aiTraceId"); else MDC.put("aiTraceId", previousTraceId);
        }
    }

    private CourseRagAnswer answerWithTrace(CourseAnswerRequest request, long startedNanos, String traceId) throws IOException {
        CourseAnswerPreparation prepared = preparationService.prepare(request, startedNanos);
        if (prepared.hasImmediateAnswer()) {
            traceService.record(traceId, "worker-1", "Answer Generation", "REQUEST", "SKIPPED", null, null, "Request returned an immediate policy response");
            recordDownstreamWorkersSkipped(traceId, "Immediate policy response; no answer generation needed");
            return prepared.immediateAnswer();
        }

        Optional<CourseRagAnswer> blockedAnswer = resultService.validateGrounding(prepared);
        if (blockedAnswer.isPresent()) {
            traceService.record(traceId, "worker-1", "Answer Generation", "REQUEST", "SKIPPED", null, null, "Grounding policy blocked generation");
            recordDownstreamWorkersSkipped(traceId, "Grounding policy blocked generation");
            return blockedAnswer.get();
        }

        Optional<CourseRagAnswer> cachedAnswer = cacheStageService.find(prepared);
        if (cachedAnswer.isPresent()) {
            traceService.record(traceId, "worker-1", "Answer Generation", "REQUEST", "CACHED", null, null, "Answer returned from cache");
            recordDownstreamWorkersSkipped(traceId, "Cache hit; no generation needed");
            return cachedAnswer.get();
        }

        try {
            CourseRagAnswer answer = generationStageService.generate(prepared);
            traceService.record(traceId, "worker-1", "Answer Generation", "REQUEST", "SUCCESS", null,
                    java.util.concurrent.TimeUnit.NANOSECONDS.toMillis(System.nanoTime() - startedNanos), "Answer generation pipeline completed");
            return answer;
        } catch (RuntimeException exception) {
            traceService.record(traceId, "worker-1", "Answer Generation", "REQUEST", "FAILED", null,
                    java.util.concurrent.TimeUnit.NANOSECONDS.toMillis(System.nanoTime() - startedNanos), exception.getClass().getSimpleName());
            throw exception;
        }
    }
}
