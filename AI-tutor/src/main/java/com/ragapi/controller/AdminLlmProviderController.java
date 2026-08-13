package com.ragapi.controller;

import com.ragapi.service.OpenRouterChatService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/admin/llm-providers")
public class AdminLlmProviderController {

    private final OpenRouterChatService chatService;

    @GetMapping("/stats")
    public ResponseEntity<?> stats() {
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("generatedAt", Instant.now());
        response.put("scope", "CURRENT_BACKEND_RUNTIME");
        response.put("providers", chatService.providerStats());
        response.put("note", "Counters reset when the Backend container restarts.");
        return ResponseEntity.ok(response);
    }
}
