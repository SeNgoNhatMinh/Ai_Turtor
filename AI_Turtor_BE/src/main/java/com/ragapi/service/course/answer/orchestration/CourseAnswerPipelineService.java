package com.ragapi.service.course.answer.orchestration;

import com.ragapi.dto.CourseRagAnswer;
import com.ragapi.service.course.model.CourseAnswerRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.util.Optional;

/** Coordinates the answer stages while keeping each stage independently replaceable. */
@Service
@RequiredArgsConstructor
public class CourseAnswerPipelineService {

    private final CourseAnswerPreparationService preparationService;
    private final CourseAnswerResultService resultService;
    private final CourseAnswerCacheStageService cacheStageService;
    private final CourseAnswerGenerationStageService generationStageService;

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
