package com.ragapi.controller;

import com.ragapi.service.aiworker.AiWorkerTraceService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/admin/ai-worker-traces")
public class AdminAiWorkerTraceController {
    private final AiWorkerTraceService traceService;

    @GetMapping
    public ResponseEntity<?> recent(@RequestParam(defaultValue = "100") int limit) {
        return ResponseEntity.ok(traceService.recent(limit));
    }
}