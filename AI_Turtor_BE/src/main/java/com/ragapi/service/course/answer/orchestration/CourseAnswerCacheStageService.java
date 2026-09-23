package com.ragapi.service.course.answer.orchestration;

import com.ragapi.dto.CourseRagAnswer;
import com.ragapi.dto.RagSourceEvidence;
import com.ragapi.service.CanonicalTutorAnswerCacheService;
import com.ragapi.service.TutorCacheHitAuditService;
import com.ragapi.service.course.answer.grounding.CourseAnswerEvidenceService;
import com.ragapi.service.course.model.RetrievedCourseChunk;
import com.ragapi.util.GroundedContentGuard;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Optional;

/** Looks up cached answers and revalidates their evidence against current material. */
@Slf4j
@Service
@RequiredArgsConstructor
public class CourseAnswerCacheStageService {

    private final CanonicalTutorAnswerCacheService answerCacheService;
    private final TutorCacheHitAuditService cacheHitAuditService;
    private final CourseAnswerEvidenceService evidenceService;

    public Optional<CourseRagAnswer> find(CourseAnswerPreparation prepared) {
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
        String validatedAnswer = GroundedContentGuard.stripUnsupportedOptionalSections(
                hit.getAnswer(), prepared.context());
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
}
