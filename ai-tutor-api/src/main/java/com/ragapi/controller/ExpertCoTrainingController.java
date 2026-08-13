package com.ragapi.controller;

import com.ragapi.dto.cotraining.*;
import com.ragapi.service.ChapterOutlineService;
import com.ragapi.service.ExpertCoTrainingService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/v2/expert-training")
@RequiredArgsConstructor
@Tag(name = "V2 Expert Co-Training", description = "Proactive expert tasks, Gold Q&A, rubrics, coverage gaps and offline AI evaluation")
public class ExpertCoTrainingController {
    private final ExpertCoTrainingService service;
    private final ChapterOutlineService chapterOutlineService;

    @GetMapping("/chapters/suggested")
    @Operation(summary = "Suggest course chapters from indexed materials (headings/titles)")
    public ResponseEntity<?> suggestChapters(@RequestParam String courseId) {
        return respond(() -> Map.of("chapters", chapterOutlineService.suggestChapters(courseId)));
    }

    @PostMapping("/chapters/confirm")
    @Operation(summary = "Confirm which suggested chapters senior will use for V2 coverage")
    public ResponseEntity<?> confirmChapters(@RequestBody ConfirmChaptersRequest request) {
        return respond(() -> Map.of("chapters", chapterOutlineService.confirmChapters(request)));
    }

    @PostMapping("/chapters/manual")
    @Operation(summary = "Add a chapter manually when senior sees a missing topic")
    public ResponseEntity<?> addManualChapter(@RequestBody ManualChapterRequest request) {
        return respond(() -> Map.of("chapter", chapterOutlineService.addManualChapter(request)));
    }

    @GetMapping("/chapters/{chapterKey}/preview")
    @Operation(summary = "Preview indexed material excerpt mapped to a chapter")
    public ResponseEntity<?> previewChapter(
            @PathVariable String chapterKey,
            @RequestParam String courseId,
            @RequestParam(required = false, defaultValue = "false") boolean expanded) {
        return respond(() -> chapterOutlineService.previewChapter(courseId, chapterKey, expanded));
    }

    @GetMapping("/chapters/preview")
    @Operation(summary = "Preview chapter material by chapter title (for mentor task context)")
    public ResponseEntity<?> previewChapterByTitle(
            @RequestParam String courseId,
            @RequestParam String chapter,
            @RequestParam(required = false, defaultValue = "true") boolean expanded) {
        return respond(() -> chapterOutlineService.previewChapterByTitle(courseId, chapter, expanded));
    }

    @PostMapping("/chapters/tasks")
    @Operation(summary = "Senior manually creates Gold Q&A tasks for a chapter")
    public ResponseEntity<?> createChapterTasks(@RequestBody CreateChapterTasksRequest request) {
        return respond(() -> Map.of("tasks", service.createChapterTasks(request)));
    }

    @PostMapping("/coverage/analyze")
    @Operation(summary = "Analyze course/chapter coverage and optionally create expert tasks")
    public ResponseEntity<?> analyzeCoverage(@RequestBody CoverageAnalysisRequest request) {
        return respond(() -> Map.of("gaps", service.analyzeCoverage(request)));
    }

    @GetMapping("/coverage-gaps")
    public ResponseEntity<?> listGaps(@RequestParam String courseId) {
        return respond(() -> Map.of("gaps", service.listGaps(courseId)));
    }

    @PostMapping("/tasks")
    public ResponseEntity<?> createTask(@RequestBody CreateExpertTaskRequest request) {
        return respond(() -> service.createTask(request));
    }

    @GetMapping("/tasks")
    public ResponseEntity<?> listTasks(
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String courseId,
            @RequestParam(required = false) String assigneeId) {
        return respond(() -> Map.of("tasks", service.listTasks(status, courseId, assigneeId)));
    }

    @PostMapping("/tasks/{id}/assign")
    public ResponseEntity<?> assignTask(@PathVariable String id, @RequestBody AssignExpertTaskRequest request) {
        return respond(() -> service.assignTask(id, request));
    }

    @PostMapping("/gold-qa")
    public ResponseEntity<?> submitGoldQa(@RequestBody SubmitGoldQaRequest request) {
        return respond(() -> service.submitGoldQa(request));
    }

    @GetMapping("/gold-qa")
    public ResponseEntity<?> listGoldQa(
            @RequestParam String courseId,
            @RequestParam(required = false) String usage,
            @RequestParam(required = false) String status) {
        return respond(() -> Map.of("items", service.listGoldQa(courseId, usage, status)));
    }

    @PostMapping("/gold-qa/{id}/approve")
    public ResponseEntity<?> approveGoldQa(@PathVariable String id, @RequestBody ExpertReviewRequest request) {
        return respondChecked(() -> service.reviewGoldQa(id, request, true));
    }

    @PostMapping("/gold-qa/{id}/reject")
    public ResponseEntity<?> rejectGoldQa(@PathVariable String id, @RequestBody ExpertReviewRequest request) {
        return respondChecked(() -> service.reviewGoldQa(id, request, false));
    }

    @PostMapping("/rubrics")
    public ResponseEntity<?> submitRubric(@RequestBody SubmitRubricRequest request) {
        return respond(() -> service.submitRubric(request));
    }

    @GetMapping("/rubrics")
    public ResponseEntity<?> listRubrics(@RequestParam String courseId) {
        return respond(() -> Map.of("items", service.listRubrics(courseId)));
    }

    @PostMapping("/rubrics/{id}/approve")
    public ResponseEntity<?> approveRubric(@PathVariable String id, @RequestBody ExpertReviewRequest request) {
        return respond(() -> service.reviewRubric(id, request, true));
    }

    @PostMapping("/rubrics/{id}/reject")
    public ResponseEntity<?> rejectRubric(@PathVariable String id, @RequestBody ExpertReviewRequest request) {
        return respond(() -> service.reviewRubric(id, request, false));
    }

    @PostMapping("/eval-runs")
    public ResponseEntity<?> startEvalRun(@RequestBody StartEvalRunRequest request) {
        return respond(() -> service.runEvaluation(request));
    }

    @GetMapping("/eval-runs")
    public ResponseEntity<?> listEvalRuns(@RequestParam String courseId) {
        return respond(() -> Map.of("runs", service.listEvalRuns(courseId)));
    }

    @GetMapping("/eval-runs/{id}")
    public ResponseEntity<?> evalRunDetail(@PathVariable String id) {
        return respond(() -> service.evalRunDetail(id));
    }

    private ResponseEntity<?> respond(Action action) {
        try { return ResponseEntity.ok(action.run()); }
        catch (IllegalArgumentException e) { return ResponseEntity.badRequest().body(Map.of("error", e.getMessage())); }
        catch (Exception e) { return ResponseEntity.internalServerError().body(Map.of("error", e.getMessage() == null ? "Server error" : e.getMessage())); }
    }

    private ResponseEntity<?> respondChecked(CheckedAction action) {
        try { return ResponseEntity.ok(action.run()); }
        catch (IllegalArgumentException e) { return ResponseEntity.badRequest().body(Map.of("error", e.getMessage())); }
        catch (Exception e) { return ResponseEntity.internalServerError().body(Map.of("error", e.getMessage() == null ? "Server error" : e.getMessage())); }
    }

    @FunctionalInterface private interface Action { Object run(); }
    @FunctionalInterface private interface CheckedAction { Object run() throws Exception; }
}
