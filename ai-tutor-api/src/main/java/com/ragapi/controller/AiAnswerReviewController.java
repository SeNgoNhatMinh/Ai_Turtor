package com.ragapi.controller;

import com.ragapi.dto.AiAnswerReviewRequest;
import com.ragapi.dto.SeniorReviewResolutionRequest;
import com.ragapi.service.AiAnswerReviewService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.AllArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@Slf4j
@RestController
@RequestMapping("/api/tutor/answer-reviews")
@AllArgsConstructor
@Tag(
        name = "AI Answer Reviews",
        description = "Human review workflow for AI Tutor answers. Reviews can flag wrong answers for senior mentor validation before AI learns."
)
public class AiAnswerReviewController {

    private final AiAnswerReviewService reviewService;

    @PostMapping
    @Operation(
            summary = "Submit a human review for an AI answer",
            description = "Use this after RAG_TUTOR, CODE, or ESCALATE responses. Learning disputes are routed to mentor review; source conflicts or missing materials can be routed to senior review. Operational/class policy feedback is stored but not sent to AI brain."
    )
    public ResponseEntity<?> submitReview(@RequestBody AiAnswerReviewRequest request) {
        try {
            return ResponseEntity.ok(reviewService.submitReview(request));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        } catch (Exception e) {
            log.error("Error submitting AI answer review", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", e.getMessage()));
        }
    }

    @GetMapping
    @Operation(
            summary = "List AI answer reviews",
            description = "Filter reviews by status, courseId, or studentId for dashboards and n8n monitoring."
    )
    public ResponseEntity<?> listReviews(
            @Parameter(description = "SUBMITTED, NEEDS_SENIOR_REVIEW, or RESOLVED")
            @RequestParam(value = "status", required = false) String status,
            @RequestParam(value = "courseId", required = false) String courseId,
            @RequestParam(value = "studentId", required = false) String studentId
    ) {
        try {
            var reviews = reviewService.listReviews(status, courseId, studentId);
            return ResponseEntity.ok(Map.of("count", reviews.size(), "reviews", reviews));
        } catch (Exception e) {
            log.error("Error listing AI answer reviews", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", e.getMessage()));
        }
    }


    @GetMapping("/mentor-pending")
    @Operation(
            summary = "List reviews waiting for mentor review",
            description = "Crowd-aggregated MODERATE tier (typically 2-3 stars). Returns `groups[]` (one card per same AI answer) plus flat `reviews[]` for backward compatibility."
    )
    public ResponseEntity<?> listMentorPending(
            @RequestParam(value = "courseId", required = false) String courseId
    ) {
        try {
            var reviews = reviewService.listReviews("NEEDS_MENTOR_REVIEW", courseId, null);
            var groups = reviewService.listGroupedPending("NEEDS_MENTOR_REVIEW", courseId);
            return ResponseEntity.ok(Map.of(
                    "count", reviews.size(),
                    "groupCount", groups.size(),
                    "groups", groups,
                    "reviews", reviews
            ));
        } catch (Exception e) {
            log.error("Error listing mentor pending AI answer reviews", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", e.getMessage()));
        }
    }
    @GetMapping("/senior-pending")
    @Operation(
            summary = "List reviews waiting for senior mentor validation",
            description = "Crowd-aggregated SEVERE tier (typically 1 star) plus IMMEDIATE source conflicts. Returns `groups[]` and flat `reviews[]`."
    )
    public ResponseEntity<?> listSeniorPending(
            @RequestParam(value = "courseId", required = false) String courseId
    ) {
        try {
            var reviews = reviewService.listReviews("NEEDS_SENIOR_REVIEW", courseId, null);
            var groups = reviewService.listGroupedPending("NEEDS_SENIOR_REVIEW", courseId);
            return ResponseEntity.ok(Map.of(
                    "count", reviews.size(),
                    "groupCount", groups.size(),
                    "groups", groups,
                    "reviews", reviews
            ));
        } catch (Exception e) {
            log.error("Error listing senior pending AI answer reviews", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", e.getMessage()));
        }
    }

    @PostMapping("/{id}/senior-resolve")
    @Operation(
            summary = "Resolve an AI answer review as senior mentor",
            description = "Only SENIOR_MENTOR or ADMIN may resolve. Optionally creates a KnowledgeCandidate, but that candidate still requires senior approval before indexing into RAG."
    )
    public ResponseEntity<?> resolveBySeniorReviewer(
            @PathVariable String id,
            @RequestBody SeniorReviewResolutionRequest request
    ) {
        try {
            return ResponseEntity.ok(reviewService.resolveBySeniorReviewer(id, request));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        } catch (Exception e) {
            log.error("Error resolving AI answer review", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", e.getMessage()));
        }
    }
}
