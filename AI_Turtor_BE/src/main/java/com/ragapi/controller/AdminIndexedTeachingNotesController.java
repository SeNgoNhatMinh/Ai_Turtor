package com.ragapi.controller;

import com.ragapi.dto.cotraining.UpdateIndexedTeachingNoteRequest;
import com.ragapi.entity.GoldQa;
import com.ragapi.entity.KnowledgeCandidate;
import com.ragapi.service.ExpertCoTrainingService;
import com.ragapi.service.HumanLearningService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.*;

@RestController
@RequestMapping("/api/admin/indexed-teaching-notes")
@RequiredArgsConstructor
@Tag(name = "Admin Indexed Approved Knowledge", description = "Manage Senior-approved V2 knowledge candidates indexed into RAG")
public class AdminIndexedTeachingNotesController {
    private final HumanLearningService humanLearningService;
    private final ExpertCoTrainingService expertCoTrainingService;

    @GetMapping
    @Operation(summary = "List Senior-approved knowledge candidates indexed into RAG")
    public ResponseEntity<?> list(
            @RequestParam(required = false) String courseId,
            @RequestParam(required = false) String status) {
        try {
            List<Map<String, Object>> items = new ArrayList<>();
            humanLearningService.listIndexedApprovedKnowledge(courseId, status).stream()
                    .map(this::toAdminItem)
                    .forEach(items::add);
            expertCoTrainingService.listIndexedTeachingNotes(courseId, status).stream()
                    .map(this::toAdminItem)
                    .forEach(items::add);
            return ResponseEntity.ok(Map.of("items", items));
        } catch (IllegalArgumentException error) {
            return ResponseEntity.badRequest().body(Map.of("error", error.getMessage()));
        }
    }

    @PutMapping("/{id}")
    @Operation(summary = "Edit indexed approved knowledge and optionally reindex into Elasticsearch")
    public ResponseEntity<?> update(
            @PathVariable String id,
            @RequestBody UpdateIndexedTeachingNoteRequest request) {
        try {
            boolean reindex = request == null || !Boolean.FALSE.equals(request.getReindex());
            if (expertCoTrainingService.isManagedTeachingNote(id)) {
                return ResponseEntity.ok(toAdminItem(expertCoTrainingService.updateIndexedTeachingNote(id, request)));
            }
            return ResponseEntity.ok(toAdminItem(humanLearningService.updateIndexedApprovedKnowledge(
                    id,
                    request == null ? null : request.getQuestion(),
                    request == null ? null : request.getGoldAnswer(),
                    reindex
            )));
        } catch (IllegalArgumentException error) {
            return ResponseEntity.badRequest().body(Map.of("error", error.getMessage()));
        } catch (Exception error) {
            return ResponseEntity.internalServerError().body(Map.of(
                    "error", error.getMessage() == null ? "Update failed" : error.getMessage()));
        }
    }

    @PostMapping("/{id}/reindex")
    @Operation(summary = "Rebuild Elasticsearch chunks from current Senior-approved knowledge")
    public ResponseEntity<?> reindex(@PathVariable String id) {
        try {
            if (expertCoTrainingService.isManagedTeachingNote(id)) {
                return ResponseEntity.ok(toAdminItem(expertCoTrainingService.reindexTeachingNote(id)));
            }
            return ResponseEntity.ok(toAdminItem(humanLearningService.reindexApprovedKnowledge(id)));
        } catch (IllegalArgumentException error) {
            return ResponseEntity.badRequest().body(Map.of("error", error.getMessage()));
        } catch (Exception error) {
            return ResponseEntity.internalServerError().body(Map.of(
                    "error", error.getMessage() == null ? "Reindex failed" : error.getMessage()));
        }
    }

    @PostMapping("/{id}/unindex")
    @Operation(summary = "Remove Senior-approved knowledge from Elasticsearch but keep Mongo record")
    public ResponseEntity<?> unindex(@PathVariable String id) {
        try {
            if (expertCoTrainingService.isManagedTeachingNote(id)) {
                return ResponseEntity.ok(toAdminItem(expertCoTrainingService.unindexTeachingNote(id)));
            }
            return ResponseEntity.ok(toAdminItem(humanLearningService.unindexApprovedKnowledge(id)));
        } catch (IllegalArgumentException error) {
            return ResponseEntity.badRequest().body(Map.of("error", error.getMessage()));
        } catch (Exception error) {
            return ResponseEntity.internalServerError().body(Map.of(
                    "error", error.getMessage() == null ? "Unindex failed" : error.getMessage()));
        }
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "Delete Senior-approved knowledge from Elasticsearch and MongoDB")
    public ResponseEntity<?> delete(@PathVariable String id) {
        try {
            if (expertCoTrainingService.isManagedTeachingNote(id)) {
                expertCoTrainingService.deleteIndexedTeachingNote(id);
            } else {
                humanLearningService.deleteIndexedApprovedKnowledge(id);
            }
            return ResponseEntity.ok(Map.of("deleted", true, "id", id));
        } catch (IllegalArgumentException error) {
            return ResponseEntity.badRequest().body(Map.of("error", error.getMessage()));
        } catch (Exception error) {
            return ResponseEntity.internalServerError().body(Map.of(
                    "error", error.getMessage() == null ? "Delete failed" : error.getMessage()));
        }
    }

    private Map<String, Object> toAdminItem(KnowledgeCandidate candidate) {
        Map<String, Object> item = new LinkedHashMap<>();
        item.put("id", candidate.getId());
        item.put("courseId", candidate.getCourseId());
        item.put("classId", candidate.getClassId());
        item.put("question", candidate.getQuestion());
        item.put("goldAnswer", candidate.getAnswer());
        item.put("answer", candidate.getAnswer());
        item.put("content", candidate.getContent());
        item.put("status", candidate.getStatus());
        item.put("materialId", candidate.getMaterialId());
        item.put("sourceType", candidate.getSourceType());
        item.put("candidateType", candidate.getCandidateType());
        item.put("reviewedBy", candidate.getReviewedBy());
        item.put("reviewerName", candidate.getReviewerName());
        item.put("indexedAt", candidate.getIndexedAt());
        item.put("updatedAt", candidate.getUpdatedAt());
        item.put("chapter", candidate.getCandidateType() == null ? "Kiến thức Senior duyệt" : candidate.getCandidateType());
        item.put("authorId", candidate.getTeacherId());
        return item;
    }

    private Map<String, Object> toAdminItem(GoldQa gold) {
        String approvedAnswer = gold.getApprovedAnswer();
        if ((approvedAnswer == null || approvedAnswer.isBlank())
                && Boolean.TRUE.equals(gold.getExamUsedTeachingNote())) {
            approvedAnswer = gold.getExamAiAnswer();
        }
        if (approvedAnswer == null || approvedAnswer.isBlank()) {
            approvedAnswer = gold.getGoldAnswer();
        }
        Map<String, Object> item = new LinkedHashMap<>();
        item.put("id", gold.getId());
        item.put("courseId", gold.getCourseId());
        item.put("classId", null);
        item.put("question", gold.getQuestion());
        item.put("goldAnswer", approvedAnswer);
        item.put("answer", approvedAnswer);
        item.put("content", approvedAnswer);
        item.put("status", gold.getStatus());
        item.put("materialId", gold.getId());
        item.put("sourceType", "GOLD_QA");
        item.put("candidateType", "V2_GOLD_QA");
        item.put("reviewedBy", gold.getReviewedBy());
        item.put("indexedAt", gold.getIndexedAt());
        item.put("updatedAt", gold.getUpdatedAt());
        item.put("chapter", gold.getChapter());
        item.put("authorId", gold.getAuthorId());
        return item;
    }
}
