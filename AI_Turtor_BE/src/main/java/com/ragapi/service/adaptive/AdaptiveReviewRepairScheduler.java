package com.ragapi.service.adaptive;

import com.ragapi.entity.AdaptiveLearningReview;
import com.ragapi.repository.AdaptiveLearningReviewRepository;
import com.ragapi.service.AdaptiveLearningReviewService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.PageRequest;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.util.List;

/**
 * Keeps adaptive assessments automatic: when an LLM reply is not usable JSON,
 * repair those PENDING reviews in the background so teachers only read and review.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class AdaptiveReviewRepairScheduler {
    private static final int BATCH = 5;

    private final AdaptiveLearningReviewRepository reviewRepository;
    private final AdaptiveLearningReviewService reviewService;

    @Scheduled(fixedDelayString = "${adaptive.review.repair-delay-ms:120000}", initialDelayString = "45000")
    public void repairFailedEvaluations() {
        List<AdaptiveLearningReview> failed = reviewRepository.findPendingWithEvaluationError(PageRequest.of(0, BATCH));
        if (failed.isEmpty()) return;
        log.info("Auto-repairing {} adaptive review(s) with evaluation errors", failed.size());
        for (AdaptiveLearningReview review : failed) {
            try {
                AdaptiveLearningReview updated = reviewService.retryEvaluation(review.getId());
                if (updated.getEvaluationError() == null || updated.getEvaluationError().isBlank()) {
                    log.info("Auto-repaired adaptive review {}", review.getId());
                } else {
                    log.warn("Adaptive review {} still incomplete after auto-repair", review.getId());
                }
            } catch (Exception error) {
                log.warn("Auto-repair failed for adaptive review {}: {}",
                        review.getId(), error.getMessage());
            }
        }
    }
}
