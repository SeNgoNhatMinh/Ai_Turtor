package com.ragapi.controller;

import com.ragapi.dto.AdaptiveLearningReviewDecisionRequest;
import com.ragapi.entity.AdaptiveLearningReview;
import com.ragapi.service.AccessGuardService;
import com.ragapi.service.AdaptiveLearningReviewService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/teacher/ai-support/learning-reviews")
@RequiredArgsConstructor
public class AdaptiveLearningReviewController {
    private final AdaptiveLearningReviewService reviewService;
    private final AccessGuardService accessGuard;

    @GetMapping
    public ResponseEntity<?> list(
            @RequestParam String courseId,
            @RequestParam String classId,
            Authentication authentication) {
        try {
            accessGuard.allowTeacherForClassOrAdmin(
                    requesterId(authentication), requesterRole(authentication), courseId, classId);
            return ResponseEntity.ok(Map.of("reviews", reviewService.listForTeacher(courseId, classId)));
        } catch (IllegalArgumentException error) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("error", error.getMessage()));
        }
    }

    @GetMapping("/{reviewId}")
    public ResponseEntity<?> detail(@PathVariable String reviewId, Authentication authentication) {
        try {
            AdaptiveLearningReview review = reviewService.get(reviewId);
            accessGuard.allowTeacherForClassOrAdmin(
                    requesterId(authentication), requesterRole(authentication),
                    review.getCourseId(), review.getClassId());
            return ResponseEntity.ok(review);
        } catch (IllegalArgumentException error) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("error", error.getMessage()));
        }
    }

    @PostMapping("/{reviewId}/decision")
    public ResponseEntity<?> decide(
            @PathVariable String reviewId,
            @RequestBody AdaptiveLearningReviewDecisionRequest request,
            Authentication authentication) {
        try {
            AdaptiveLearningReview review = reviewService.get(reviewId);
            accessGuard.allowTeacherForClassOrAdmin(
                    requesterId(authentication), requesterRole(authentication),
                    review.getCourseId(), review.getClassId());
            return ResponseEntity.ok(reviewService.decide(reviewId, requesterId(authentication), request));
        } catch (IllegalStateException error) {
            return ResponseEntity.status(HttpStatus.CONFLICT).body(Map.of("error", error.getMessage()));
        } catch (IllegalArgumentException error) {
            return ResponseEntity.badRequest().body(Map.of("error", error.getMessage()));
        }
    }

    private String requesterId(Authentication authentication) {
        return authentication == null ? null : authentication.getName();
    }

    private String requesterRole(Authentication authentication) {
        if (authentication == null) return null;
        return authentication.getAuthorities().stream()
                .map(authority -> authority.getAuthority())
                .filter(value -> value != null && value.startsWith("ROLE_"))
                .map(value -> value.substring("ROLE_".length()))
                .findFirst().orElse(null);
    }
}
