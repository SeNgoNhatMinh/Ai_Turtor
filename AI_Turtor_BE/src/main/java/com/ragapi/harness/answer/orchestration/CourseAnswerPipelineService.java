package com.ragapi.harness.answer.orchestration;

import com.ragapi.dto.CourseRagAnswer;
import com.ragapi.dto.RagSourceEvidence;
import com.ragapi.harness.answer.grounding.CourseAnswerEvidenceService;
import com.ragapi.harness.model.CourseAnswerRequest;
import com.ragapi.harness.model.RetrievedCourseChunk;
import com.ragapi.harness.review.CanonicalTutorAnswerCacheService;
import com.ragapi.harness.review.TutorCacheHitAuditService;
import com.ragapi.harness.util.GroundedContentGuard;
import com.ragapi.harness.util.NumberedAnswerHeadings;
import com.ragapi.harness.util.GuidedPracticeGuard;
import com.ragapi.harness.util.StudentVoiceFilter;
import com.ragapi.harness.answer.policy.CourseAnswerRequestPolicyService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.util.List;
import java.util.Optional;
import org.slf4j.MDC;
import com.ragapi.harness.aiworker.AiWorkerTraceService;

/** Coordinates the answer stages while keeping each stage independently replaceable. */
@Slf4j
@Service
@RequiredArgsConstructor
public class CourseAnswerPipelineService {

    private final CourseAnswerPreparationService preparationService;
    private final CourseAnswerResultService resultService;
    private final CanonicalTutorAnswerCacheService answerCacheService;
    private final TutorCacheHitAuditService cacheHitAuditService;
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

        Optional<CourseRagAnswer> cachedAnswer = findCachedAnswer(prepared);
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

    private Optional<CourseRagAnswer> findCachedAnswer(CourseAnswerPreparation prepared) {
        if (prepared.skipAnswerCache()) {
            return Optional.empty();
        }
        String classId = prepared.request().classId();
        Optional<CourseRagAnswer> cachedAnswer = answerCacheService.lookupExactRagAnswer(
                prepared.courseId(), classId, prepared.question());
        if (cachedAnswer.isEmpty()) {
            cachedAnswer = answerCacheService.lookupEarlySemanticRagAnswer(
                    prepared.courseId(), classId, prepared.question());
        }
        if (cachedAnswer.isEmpty()) {
            cachedAnswer = answerCacheService.lookupSemanticRagAnswer(
                    prepared.courseId(),
                    classId,
                    prepared.question(),
                    prepared.confidence(),
                    prepared.sourceLabels()
            );
        }
        if (cachedAnswer.isEmpty()) {
            return Optional.empty();
        }

        log.info("Returning cached tutor answer for courseId={}", prepared.courseId());
        CourseRagAnswer hit = cachedAnswer.get();
        String cachedBody = GroundedContentGuard.stripUnsupportedOptionalSections(hit.getAnswer(), prepared.context());
        if (cachedAnswerNeedsPractice(prepared)) {
            cachedBody = insertPracticeBeforeQuiz(cachedBody, prepared);
        }
        String validatedAnswer = NumberedAnswerHeadings.number(StudentVoiceFilter.clean(cachedBody));
        List<RetrievedCourseChunk> alignedChunks = evidenceService.selectAnswerEvidenceChunks(
                prepared.chunks(), prepared.question(), validatedAnswer);
        List<String> alignedSourceLabels = evidenceService.buildSourceLabels(
                alignedChunks, prepared.materialsById());
        List<RagSourceEvidence> alignedSourceEvidence = evidenceService.buildSourceEvidence(
                alignedChunks, prepared.courseId(), prepared.materialsById(), validatedAnswer);
        CourseRagAnswer enrichedHit = CourseRagAnswer.builder()
                .answer(validatedAnswer)
                .confidence(prepared.confidence())
                .sources(alignedSourceLabels)
                .sourceEvidence(alignedSourceEvidence)
                .groundingType(prepared.groundingType())
                .escalationRecommended(false)
                .escalationReason(null)
                .cacheHitMetadata(hit.getCacheHitMetadata())
                .build();
        answerCacheService.storeRagAnswerAsync(
                prepared.courseId(), classId, prepared.question(), enrichedHit);
        return Optional.of(cacheHitAuditService.completeHit(enrichedHit, prepared.backendStartedNanos()));
    }

    private static boolean cachedAnswerNeedsPractice(CourseAnswerPreparation prepared) {
        if (prepared.understandingRemediation()
                || CourseAnswerRequestPolicyService.isFinishedWorkReview(prepared.question())) {
            return false;
        }
        String mode = prepared.request() == null ? null : prepared.request().teachingMode();
        return !"LEARNING_PATH".equalsIgnoreCase(mode) && !"LESSON_DEEP_PATH".equalsIgnoreCase(mode);
    }

    /** Old cache entries predate the required guided exercise: add it before the appended quiz. */
    private static String insertPracticeBeforeQuiz(String answer, CourseAnswerPreparation prepared) {
        if (answer == null || GuidedPracticeGuard.hasUsablePractice(answer)) {
            return answer;
        }
        java.util.regex.Matcher quiz = java.util.regex.Pattern
                .compile("(?imu)^#{1,6}\\s*(?:\\d+\\.\\s*)?kiểm tra hiểu\\s*$").matcher(answer);
        int split = quiz.find() ? quiz.start() : answer.length();
        String head = GuidedPracticeGuard.ensure(answer.substring(0, split), prepared.question(),
                CourseAnswerWorkerPipeline.resolveSupportLevel(prepared.request()));
        return (head.trim() + "\n\n" + answer.substring(split).trim()).trim();
    }
}
