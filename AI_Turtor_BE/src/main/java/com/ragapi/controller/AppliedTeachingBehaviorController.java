package com.ragapi.controller;

import com.ragapi.service.behavior.AppliedTeachingBehaviorService;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDateTime;
import java.util.Map;

import static com.ragapi.controller.TeachingBehaviorController.actor;
import static com.ragapi.controller.TeachingBehaviorController.handle;

/** Runtime assignments and the executions that show what RAG actually used. */
@RestController
@RequiredArgsConstructor
public class AppliedTeachingBehaviorController {
    private final AppliedTeachingBehaviorService appliedService;

    @GetMapping("/api/teacher/applied-teaching-behaviors")
    public ResponseEntity<?> list(
            @RequestParam(required = false) String courseId,
            @RequestParam(required = false) String studentId,
            @RequestParam(required = false) String behaviorId,
            @RequestParam(required = false) String status,
            Authentication authentication) {
        return handle(() -> appliedService.listAssignments(
                courseId, studentId, behaviorId, status, actor(authentication)));
    }

    @PostMapping("/api/teacher/applied-teaching-behaviors/{id}/status")
    public ResponseEntity<?> setStatus(
            @PathVariable String id, @RequestBody Map<String, String> body, Authentication authentication) {
        return handle(() -> appliedService.setAssignmentStatus(
                id, body == null ? null : body.get("status"), actor(authentication)));
    }

    @GetMapping("/api/teacher/teaching-behavior-executions")
    public ResponseEntity<?> executions(
            @RequestParam(required = false) String behaviorId,
            @RequestParam(required = false) String courseId,
            @RequestParam(required = false) String studentId,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime to,
            Authentication authentication) {
        return handle(() -> appliedService.listExecutions(
                behaviorId, courseId, studentId, status, from, to, actor(authentication)));
    }
}
