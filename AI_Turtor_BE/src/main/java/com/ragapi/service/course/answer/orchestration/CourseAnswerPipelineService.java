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

/** Coordinates the answer stages while keeping each stage independently replaceable. */
@Service
@RequiredArgsConstructor
public class CourseAnswerPipelineService {

    private final CourseAnswerPreparationService preparationService;
    private final CourseAnswerResultService resultService;
    private final CourseAnswerCacheStageService cacheStageService;
    private final CourseAnswerGenerationStageService generationStageService;
    private final CourseAnswerEvidenceService evidenceService;

    /**
     * A learning path only needs retrieved chapters. Generating a full tutor
     * answer here was discarded afterwards and made the turn take minutes.
     */
    public CourseRagAnswer retrieveLearningPath(CourseAnswerRequest request) throws IOException {
        CourseAnswerPreparation prepared = preparationService.prepare(request, System.nanoTime());
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

    public CourseRagAnswer answer(CourseAnswerRequest request) throws IOException {
        CourseAnswerPreparation prepared = preparationService.prepare(request, System.nanoTime());
        if (prepared.hasImmediateAnswer()) {
            return prepared.immediateAnswer();
        }

        Optional<CourseRagAnswer> blockedAnswer = resultService.validateGrounding(prepared);
        if (blockedAnswer.isPresent()) {
            return blockedAnswer.get();
        }

        Optional<CourseRagAnswer> cachedAnswer = cacheStageService.find(prepared);
        if (cachedAnswer.isPresent()) {
            return cachedAnswer.get();
        }

        return generationStageService.generate(prepared);
    }
}
