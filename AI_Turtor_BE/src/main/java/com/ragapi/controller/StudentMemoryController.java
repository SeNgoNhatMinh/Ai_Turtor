package com.ragapi.controller;

import com.ragapi.dto.PinImproveSuggestionRequest;
import com.ragapi.dto.UpdateStudentCourseMemoryRequest;
import com.ragapi.entity.StudentCourseMemory;
import com.ragapi.service.StudentCourseMemoryService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
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
@RequestMapping("/api/tutor")
@Tag(name = "Student Memory", description = "Student course-scoped memory APIs")
public class StudentMemoryController {

    private final StudentCourseMemoryService memoryService;

    @GetMapping("/students/{studentId}/courses/{courseId}/memory")
    @Operation(summary = "Get student course-scoped memory")
    public ResponseEntity<?> getMemory(
            @PathVariable String studentId,
            @PathVariable String courseId
    ) {
        try {
            StudentCourseMemory memory = memoryService.getOrCreateMemory(studentId, courseId);
            return ResponseEntity.ok(memory);
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.badRequest().body(Map.of("error", ex.getMessage()));
        } catch (Exception ex) {
            log.error("Student course memory lookup failed", ex);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Server error: " + ex.getMessage()));
        }
    }

    @PutMapping("/students/{studentId}/courses/{courseId}/memory")
    @Operation(summary = "Update student course-scoped memory")
    public ResponseEntity<?> updateMemory(
            @PathVariable String studentId,
            @PathVariable String courseId,
            @RequestBody UpdateStudentCourseMemoryRequest request
    ) {
        try {
            StudentCourseMemory memory = memoryService.updateMemory(studentId, courseId, request);
            return ResponseEntity.ok(memory);
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.badRequest().body(Map.of("error", ex.getMessage()));
        } catch (Exception ex) {
            log.error("Student course memory update failed", ex);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Server error: " + ex.getMessage()));
        }
    }

    @PostMapping("/students/{studentId}/courses/{courseId}/memory/pinned-suggestions")
    @Operation(summary = "Pin an improve suggestion so it stays visible for student review")
    public ResponseEntity<?> pinImproveSuggestion(
            @PathVariable String studentId,
            @PathVariable String courseId,
            @RequestBody PinImproveSuggestionRequest request
    ) {
        try {
            StudentCourseMemory memory = memoryService.pinImproveSuggestion(
                    studentId,
                    courseId,
                    request == null ? null : request.getSuggestion()
            );
            return ResponseEntity.ok(memory);
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.badRequest().body(Map.of("error", ex.getMessage()));
        } catch (Exception ex) {
            log.error("Pin improve suggestion failed", ex);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Server error: " + ex.getMessage()));
        }
    }

    @DeleteMapping("/students/{studentId}/courses/{courseId}/memory/pinned-suggestions")
    @Operation(summary = "Unpin an improve suggestion")
    public ResponseEntity<?> unpinImproveSuggestion(
            @PathVariable String studentId,
            @PathVariable String courseId,
            @RequestParam("suggestion") String suggestion
    ) {
        try {
            StudentCourseMemory memory = memoryService.unpinImproveSuggestion(studentId, courseId, suggestion);
            return ResponseEntity.ok(memory);
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.badRequest().body(Map.of("error", ex.getMessage()));
        } catch (Exception ex) {
            log.error("Unpin improve suggestion failed", ex);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Server error: " + ex.getMessage()));
        }
    }

    @DeleteMapping("/students/{studentId}/courses/{courseId}/memory/improve-suggestions")
    @Operation(summary = "Delete an AI improve suggestion from student memory (also unpins it)")
    public ResponseEntity<?> deleteImproveSuggestion(@PathVariable String studentId,
            @PathVariable String courseId, @RequestParam("suggestion") String suggestion) {
        try {
            return ResponseEntity.ok(memoryService.deleteImproveSuggestion(studentId, courseId, suggestion));
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.badRequest().body(Map.of("error", ex.getMessage()));
        } catch (Exception ex) {
            log.error("Delete improve suggestion failed", ex);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(Map.of("error", ex.getMessage()));
        }
    }
    @GetMapping("/courses/{courseId}/memories")
    @Operation(summary = "List student memories by course and optional class")
    public ResponseEntity<?> listCourseMemories(
            @PathVariable String courseId,
            @RequestParam(value = "classId", required = false) String classId
    ) {
        try {
            var memories = memoryService.listCourseMemories(courseId, classId);
            return ResponseEntity.ok(Map.of(
                    "courseId", courseId,
                    "classId", classId == null ? "" : classId,
                    "count", memories.size(),
                    "memories", memories
            ));
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.badRequest().body(Map.of("error", ex.getMessage()));
        } catch (Exception ex) {
            log.error("Course memories lookup failed", ex);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Server error: " + ex.getMessage()));
        }
    }
}


