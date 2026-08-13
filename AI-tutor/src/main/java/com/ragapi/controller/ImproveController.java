package com.ragapi.controller;

import com.ragapi.dto.SuggestionRequest;
import com.ragapi.dto.SuggestionResponse;
import com.ragapi.service.ImprovePlanService;
import com.ragapi.service.ImproveSuggestionService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@Slf4j
@RestController
@RequiredArgsConstructor
@RequestMapping("/api")
@Tag(name = "Improve", description = "Learning improvement suggestions and persisted improve plan APIs")
public class ImproveController {

    private final ImproveSuggestionService improveSuggestionService;
    private final ImprovePlanService improvePlanService;

    @PostMapping("/tutor/improve-suggestions")
    @Operation(summary = "Generate improve suggestions and persist an improve plan for a student course")
    public ResponseEntity<?> getTutorImproveSuggestions(@RequestBody SuggestionRequest request) {
        return buildSuggestions(request);
    }

    @GetMapping("/students/{studentId}/improve-plans")
    @Operation(summary = "List persisted improve plans for a student")
    public ResponseEntity<?> listImprovePlans(
            @PathVariable String studentId,
            @RequestParam(value = "courseId", required = false) String courseId
    ) {
        try {
            var plans = improvePlanService.listPlans(studentId, courseId);
            return ResponseEntity.ok(Map.of("studentId", studentId, "count", plans.size(), "plans", plans));
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.badRequest().body(Map.of("error", ex.getMessage()));
        } catch (Exception ex) {
            log.error("Improve plan lookup error", ex);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Server error: " + ex.getMessage()));
        }
    }

    @GetMapping({"/students/{studentId}/courses/{courseId}/improve-plan", "/improve/students/{studentId}/courses/{courseId}/latest"})
    @Operation(summary = "Get latest active improve plan for a student course")
    public ResponseEntity<?> getLatestImprovePlan(
            @PathVariable String studentId,
            @PathVariable String courseId
    ) {
        try {
            var plan = improvePlanService.getLatestActivePlan(studentId, courseId);
            if (plan == null) {
                return ResponseEntity.ok(Map.of("studentId", studentId, "courseId", courseId, "plan", ""));
            }
            return ResponseEntity.ok(plan);
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.badRequest().body(Map.of("error", ex.getMessage()));
        } catch (Exception ex) {
            log.error("Improve plan lookup error", ex);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Server error: " + ex.getMessage()));
        }
    }

    @PutMapping("/improve-plans/{planId}/complete")
    @Operation(summary = "Mark improve plan as completed")
    public ResponseEntity<?> completeImprovePlan(@PathVariable String planId) {
        try {
            return ResponseEntity.ok(improvePlanService.completePlan(planId));
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.badRequest().body(Map.of("error", ex.getMessage()));
        } catch (Exception ex) {
            log.error("Improve plan complete error", ex);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Server error: " + ex.getMessage()));
        }
    }

    private ResponseEntity<?> buildSuggestions(SuggestionRequest request) {
        try {
            SuggestionResponse response = improveSuggestionService.buildSuggestions(request);
            return ResponseEntity.ok(response);
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.badRequest().body(Map.of("error", ex.getMessage()));
        } catch (Exception ex) {
            log.error("Suggestion error", ex);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Server error: " + ex.getMessage()));
        }
    }
}