package com.ragapi.controller;

import com.ragapi.dto.cotraining.UpdateIndexedTeachingNoteRequest;
import com.ragapi.service.ExpertCoTrainingService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/admin/indexed-teaching-notes")
@RequiredArgsConstructor
@Tag(name = "Admin Indexed Teaching Notes", description = "Manage Senior-approved Gold Q&A teaching notes indexed into RAG")
public class AdminIndexedTeachingNotesController {
    private final ExpertCoTrainingService service;

    @GetMapping
    @Operation(summary = "List indexed / unindexed Gold Q&A teaching notes for admin maintenance")
    public ResponseEntity<?> list(
            @RequestParam(required = false) String courseId,
            @RequestParam(required = false) String status) {
        try {
            return ResponseEntity.ok(Map.of("items", service.listIndexedTeachingNotes(courseId, status)));
        } catch (IllegalArgumentException error) {
            return ResponseEntity.badRequest().body(Map.of("error", error.getMessage()));
        }
    }

    @PutMapping("/{id}")
    @Operation(summary = "Edit teaching-note content and optionally reindex into Elasticsearch")
    public ResponseEntity<?> update(
            @PathVariable String id,
            @RequestBody UpdateIndexedTeachingNoteRequest request) {
        try {
            return ResponseEntity.ok(service.updateIndexedTeachingNote(id, request));
        } catch (IllegalArgumentException error) {
            return ResponseEntity.badRequest().body(Map.of("error", error.getMessage()));
        } catch (Exception error) {
            return ResponseEntity.internalServerError().body(Map.of(
                    "error", error.getMessage() == null ? "Update failed" : error.getMessage()));
        }
    }

    @PostMapping("/{id}/reindex")
    @Operation(summary = "Rebuild Elasticsearch chunk from current Mongo teaching note")
    public ResponseEntity<?> reindex(@PathVariable String id) {
        try {
            return ResponseEntity.ok(service.reindexTeachingNote(id));
        } catch (IllegalArgumentException error) {
            return ResponseEntity.badRequest().body(Map.of("error", error.getMessage()));
        } catch (Exception error) {
            return ResponseEntity.internalServerError().body(Map.of(
                    "error", error.getMessage() == null ? "Reindex failed" : error.getMessage()));
        }
    }

    @PostMapping("/{id}/unindex")
    @Operation(summary = "Remove teaching note from Elasticsearch but keep Mongo record")
    public ResponseEntity<?> unindex(@PathVariable String id) {
        try {
            return ResponseEntity.ok(service.unindexTeachingNote(id));
        } catch (IllegalArgumentException error) {
            return ResponseEntity.badRequest().body(Map.of("error", error.getMessage()));
        } catch (Exception error) {
            return ResponseEntity.internalServerError().body(Map.of(
                    "error", error.getMessage() == null ? "Unindex failed" : error.getMessage()));
        }
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "Delete teaching note from Elasticsearch and MongoDB")
    public ResponseEntity<?> delete(@PathVariable String id) {
        try {
            service.deleteIndexedTeachingNote(id);
            return ResponseEntity.ok(Map.of("deleted", true, "id", id));
        } catch (IllegalArgumentException error) {
            return ResponseEntity.badRequest().body(Map.of("error", error.getMessage()));
        } catch (Exception error) {
            return ResponseEntity.internalServerError().body(Map.of(
                    "error", error.getMessage() == null ? "Delete failed" : error.getMessage()));
        }
    }
}
