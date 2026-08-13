package com.ragapi.controller;

import com.ragapi.dto.HarnessLogRequest;
import com.ragapi.service.HarnessLogService;
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
@RequestMapping("/api/harness")
@AllArgsConstructor
@Tag(
        name = "AI Harness Logs",
        description = "Trace and error logging APIs for n8n AI Harness workflows. Use these APIs to track studentId, sessionId, conversationId, node failures, and fallback decisions."
)
public class HarnessLogController {

    private final HarnessLogService harnessLogService;

    @PostMapping("/logs")
    @Operation(
            summary = "Create an AI Harness trace log",
            description = "Use from n8n after important nodes such as Intent Classifier, Course RAG Query, Code Mentor, Improve Suggestions, Update Memory, and Respond."
    )
    public ResponseEntity<?> createLog(@RequestBody HarnessLogRequest request) {
        try {
            return ResponseEntity.ok(harnessLogService.createLog(request));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        } catch (Exception e) {
            log.error("Error creating harness log", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", e.getMessage()));
        }
    }

    @PostMapping("/error-logs")
    @Operation(
            summary = "Create an AI Harness error log",
            description = "Use this from n8n error branches when Elasticsearch, LLM, backend HTTP calls, memory update, or webhook processing fails. The API forces eventType=ERROR and status=FAILED."
    )
    public ResponseEntity<?> createErrorLog(@RequestBody HarnessLogRequest request) {
        try {
            return ResponseEntity.ok(harnessLogService.createErrorLog(request));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        } catch (Exception e) {
            log.error("Error creating harness error log", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", e.getMessage()));
        }
    }

    @GetMapping("/logs")
    @Operation(
            summary = "List AI Harness logs",
            description = "Filter logs by traceId, studentId, conversationId, courseId, status, or eventType for debugging n8n workflows."
    )
    public ResponseEntity<?> listLogs(
            @RequestParam(value = "traceId", required = false) String traceId,
            @RequestParam(value = "studentId", required = false) String studentId,
            @RequestParam(value = "conversationId", required = false) String conversationId,
            @RequestParam(value = "courseId", required = false) String courseId,
            @Parameter(description = "SUCCESS, FAILED, SKIPPED, or RECOVERED")
            @RequestParam(value = "status", required = false) String status,
            @Parameter(description = "INFO, NODE_STARTED, NODE_COMPLETED, ERROR, FALLBACK, or ESCALATION_CREATED")
            @RequestParam(value = "eventType", required = false) String eventType
    ) {
        try {
            var logs = harnessLogService.listLogs(traceId, studentId, conversationId, courseId, status, eventType);
            return ResponseEntity.ok(Map.of("count", logs.size(), "logs", logs));
        } catch (Exception e) {
            log.error("Error listing harness logs", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", e.getMessage()));
        }
    }

    @GetMapping("/error-logs")
    @Operation(
            summary = "List AI Harness error logs",
            description = "Shortcut endpoint for dashboard/error monitoring. Returns eventType=ERROR and status=FAILED logs."
    )
    public ResponseEntity<?> listErrorLogs(
            @RequestParam(value = "traceId", required = false) String traceId,
            @RequestParam(value = "studentId", required = false) String studentId,
            @RequestParam(value = "courseId", required = false) String courseId
    ) {
        try {
            var logs = harnessLogService.listErrorLogs(traceId, studentId, courseId);
            return ResponseEntity.ok(Map.of("count", logs.size(), "logs", logs));
        } catch (Exception e) {
            log.error("Error listing harness error logs", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", e.getMessage()));
        }
    }

    @GetMapping("/traces/{traceId}")
    @Operation(
            summary = "Get all logs for one AI Harness trace",
            description = "Use traceId to reconstruct the full path of one student request across n8n nodes and backend calls."
    )
    public ResponseEntity<?> getTrace(@PathVariable String traceId) {
        try {
            var logs = harnessLogService.getTrace(traceId);
            return ResponseEntity.ok(Map.of("traceId", traceId, "count", logs.size(), "logs", logs));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        } catch (Exception e) {
            log.error("Error getting harness trace", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", e.getMessage()));
        }
    }
}
