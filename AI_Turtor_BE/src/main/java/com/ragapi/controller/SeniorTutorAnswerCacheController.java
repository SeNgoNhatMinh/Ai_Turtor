package com.ragapi.controller;

import com.ragapi.dto.SeniorTutorAnswerCacheUpdateRequest;
import com.ragapi.service.TutorAnswerCacheSeniorService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@Slf4j
@RestController
@RequiredArgsConstructor
@RequestMapping("/api/tutor/answer-cache")
@Tag(
        name = "Tutor Answer Cache (Senior)",
        description = "Senior mentor controls for canonical/semantic AI answer cache used by RAG and Code Mentor."
)
public class SeniorTutorAnswerCacheController {

    private final TutorAnswerCacheSeniorService cacheSeniorService;

    @GetMapping
    @Operation(summary = "List cached AI answers for a course")
    public ResponseEntity<?> list(
            @RequestParam("courseId") String courseId,
            @RequestParam(value = "classId", required = false) String classId,
            @RequestParam(value = "mode", required = false) String mode,
            @RequestParam(value = "reviewStatus", required = false) String reviewStatus
    ) {
        try {
            var entries = cacheSeniorService.list(courseId, classId, mode, reviewStatus);
            return ResponseEntity.ok(Map.of("count", entries.size(), "entries", entries));
        } catch (IllegalArgumentException error) {
            return ResponseEntity.badRequest().body(Map.of("error", error.getMessage()));
        } catch (Exception error) {
            log.error("Error listing tutor answer cache", error);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(Map.of("error", error.getMessage()));
        }
    }

    @GetMapping("/stats")
    @Operation(summary = "Cache stats grouped by senior review status")
    public ResponseEntity<?> stats(@RequestParam("courseId") String courseId) {
        try {
            return ResponseEntity.ok(cacheSeniorService.stats(courseId));
        } catch (IllegalArgumentException error) {
            return ResponseEntity.badRequest().body(Map.of("error", error.getMessage()));
        } catch (Exception error) {
            log.error("Error loading tutor answer cache stats", error);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(Map.of("error", error.getMessage()));
        }
    }

    @GetMapping("/diagnostics")
    @Operation(summary = "Cache tier configuration and runtime diagnostics")
    public ResponseEntity<?> diagnostics(@RequestParam("courseId") String courseId) {
        try {
            return ResponseEntity.ok(cacheSeniorService.diagnostics(courseId));
        } catch (IllegalArgumentException error) {
            return ResponseEntity.badRequest().body(Map.of("error", error.getMessage()));
        } catch (Exception error) {
            log.error("Error loading tutor answer cache diagnostics", error);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(Map.of("error", error.getMessage()));
        }
    }

    @GetMapping("/hits/recent")
    @Operation(summary = "Recent persistent cache-hit timing audits")
    public ResponseEntity<?> recentHits(
            @RequestParam("courseId") String courseId,
            @RequestParam(value = "limit", defaultValue = "50") int limit
    ) {
        try {
            var hits = cacheSeniorService.recentHits(courseId, limit);
            return ResponseEntity.ok(Map.of("count", hits.size(), "hits", hits));
        } catch (IllegalArgumentException error) {
            return ResponseEntity.badRequest().body(Map.of("error", error.getMessage()));
        } catch (Exception error) {
            log.error("Error loading recent tutor cache hits", error);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(Map.of("error", error.getMessage()));
        }
    }

    @GetMapping("/{cacheId}")
    @Operation(summary = "Get one cached AI answer entry")
    public ResponseEntity<?> get(@PathVariable String cacheId) {
        try {
            return ResponseEntity.ok(cacheSeniorService.get(cacheId));
        } catch (IllegalArgumentException error) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", error.getMessage()));
        } catch (Exception error) {
            log.error("Error loading tutor answer cache entry {}", cacheId, error);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(Map.of("error", error.getMessage()));
        }
    }

    @PostMapping("/{cacheId}/approve")
    @Operation(summary = "Mark a cached answer as senior-approved")
    public ResponseEntity<?> approve(
            @PathVariable String cacheId,
            @RequestBody SeniorTutorAnswerCacheUpdateRequest request
    ) {
        return mutate(() -> cacheSeniorService.approve(cacheId, request), "APPROVED");
    }

    @PatchMapping("/{cacheId}")
    @Operation(summary = "Replace a cached answer with senior-corrected content")
    public ResponseEntity<?> correct(
            @PathVariable String cacheId,
            @RequestBody SeniorTutorAnswerCacheUpdateRequest request
    ) {
        return mutate(() -> cacheSeniorService.correct(cacheId, request), "CORRECTED");
    }

    @PostMapping("/{cacheId}/disable")
    @Operation(summary = "Disable a cached answer so students no longer receive it")
    public ResponseEntity<?> disable(
            @PathVariable String cacheId,
            @RequestBody SeniorTutorAnswerCacheUpdateRequest request
    ) {
        return mutate(() -> cacheSeniorService.disable(cacheId, request), "DISABLED");
    }

    @DeleteMapping("/{cacheId}")
    @Operation(summary = "Delete a cached answer entry")
    public ResponseEntity<?> delete(
            @PathVariable String cacheId,
            @RequestBody SeniorTutorAnswerCacheUpdateRequest request
    ) {
        try {
            cacheSeniorService.delete(cacheId, request);
            return ResponseEntity.ok(Map.of("status", "DELETED", "cacheId", cacheId));
        } catch (IllegalArgumentException error) {
            return ResponseEntity.badRequest().body(Map.of("error", error.getMessage()));
        } catch (Exception error) {
            log.error("Error deleting tutor answer cache entry {}", cacheId, error);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(Map.of("error", error.getMessage()));
        }
    }

    private ResponseEntity<?> mutate(java.util.function.Supplier<Object> action, String status) {
        try {
            return ResponseEntity.ok(Map.of("status", status, "entry", action.get()));
        } catch (IllegalArgumentException error) {
            return ResponseEntity.badRequest().body(Map.of("error", error.getMessage()));
        } catch (Exception error) {
            log.error("Error updating tutor answer cache entry", error);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(Map.of("error", error.getMessage()));
        }
    }
}
