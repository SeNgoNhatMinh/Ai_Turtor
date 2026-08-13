package com.ragapi.controller;

import com.ragapi.dto.KnowledgeCandidateReviewRequest;
import com.ragapi.service.HumanLearningService;
import io.swagger.v3.oas.annotations.Operation;
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
@RequestMapping({"/api/tutor/escalations/knowledge-candidates", "/api/tutor/knowledge-candidates"})
@AllArgsConstructor
@Tag(name = "Knowledge Candidates", description = "Senior mentor approval queue before AI Tutor can learn new knowledge")
public class KnowledgeCandidateController {

    private final HumanLearningService humanLearningService;

    @GetMapping
    @Operation(summary = "List knowledge candidates", description = "List AI learning candidates by status/course. Only INDEXED candidates have entered the RAG brain.")
    public ResponseEntity<?> listKnowledgeCandidates(
            @RequestParam(value = "status", required = false) String status,
            @RequestParam(value = "courseId", required = false) String courseId
    ) {
        try {
            var candidates = humanLearningService.listCandidates(status, courseId);
            return ResponseEntity.ok(Map.of("count", candidates.size(), "candidates", candidates));
        } catch (Exception e) {
            log.error("Error listing knowledge candidates", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", e.getMessage()));
        }
    }

    @GetMapping("/pending")
    @Operation(summary = "List candidates waiting for senior mentor review", description = "Teacher answers and low-quality AI review corrections wait here before AI Tutor can learn them.")
    public ResponseEntity<?> listPendingKnowledgeCandidates(
            @RequestParam(value = "teacherId", required = false) String teacherId,
            @RequestParam(value = "courseId", required = false) String courseId
    ) {
        try {
            var candidates = humanLearningService.listCandidates("PENDING_SENIOR_REVIEW", courseId);
            if (teacherId != null && !teacherId.isBlank()) {
                candidates = candidates.stream()
                        .filter(candidate -> teacherId.equals(candidate.getTeacherId()))
                        .toList();
            }
            return ResponseEntity.ok(Map.of("count", candidates.size(), "candidates", candidates));
        } catch (Exception e) {
            log.error("Error listing pending knowledge candidates", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", e.getMessage()));
        }
    }

    @GetMapping("/senior-pending")
    @Operation(summary = "Alias: list senior mentor pending candidates")
    public ResponseEntity<?> listSeniorPendingKnowledgeCandidates(
            @RequestParam(value = "teacherId", required = false) String teacherId,
            @RequestParam(value = "courseId", required = false) String courseId
    ) {
        return listPendingKnowledgeCandidates(teacherId, courseId);
    }

    @PostMapping("/{id}/approve")
    @Operation(summary = "Senior mentor approves and indexes knowledge into course RAG", description = "Requires reviewerRole=SENIOR_MENTOR or ADMIN. The original answering mentor cannot approve their own candidate.")
    public ResponseEntity<?> approveKnowledgeCandidate(
            @PathVariable String id,
            @RequestBody(required = false) KnowledgeCandidateReviewRequest request
    ) {
        try {
            return ResponseEntity.ok(humanLearningService.approveCandidate(id, request));
        } catch (Exception e) {
            log.error("Error approving knowledge candidate", e);
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(Map.of("error", e.getMessage()));
        }
    }

    @PostMapping("/{id}/reject")
    @Operation(summary = "Senior mentor rejects a knowledge candidate", description = "Requires reviewerRole=SENIOR_MENTOR or ADMIN. Rejected knowledge is not indexed into AI Tutor brain.")
    public ResponseEntity<?> rejectKnowledgeCandidate(
            @PathVariable String id,
            @RequestBody(required = false) KnowledgeCandidateReviewRequest request
    ) {
        try {
            return ResponseEntity.ok(humanLearningService.rejectCandidate(id, request));
        } catch (Exception e) {
            log.error("Error rejecting knowledge candidate", e);
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(Map.of("error", e.getMessage()));
        }
    }
}
