package com.ragapi.controller;

import com.ragapi.service.course.indexing.ReindexRunService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/admin/materials/reindex-runs")
@RequiredArgsConstructor
public class AdminReindexRunController {

    private final ReindexRunService reindexRuns;

    @PostMapping
    public ResponseEntity<?> start(@RequestBody(required = false) Map<String, Object> body, Authentication authentication) {
        try {
            return ResponseEntity.accepted().body(reindexRuns.start(courseIds(body), role(authentication)));
        } catch (SecurityException error) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("error", error.getMessage()));
        } catch (IllegalArgumentException error) {
            return ResponseEntity.badRequest().body(Map.of("error", error.getMessage()));
        }
    }

    @GetMapping("/current")
    public ResponseEntity<?> current(Authentication authentication) {
        try {
            return ResponseEntity.ok(reindexRuns.current(role(authentication)));
        } catch (SecurityException error) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("error", error.getMessage()));
        }
    }

    @PostMapping("/current/stop")
    public ResponseEntity<?> stop(Authentication authentication) {
        try {
            return ResponseEntity.accepted().body(reindexRuns.stop(role(authentication)));
        } catch (SecurityException error) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("error", error.getMessage()));
        }
    }

    private static List<String> courseIds(Map<String, Object> body) {
        Object raw = body == null ? null : body.get("courseIds");
        if (!(raw instanceof List<?> values)) {
            return List.of();
        }
        return values.stream().map(value -> value == null ? "" : String.valueOf(value)).toList();
    }

    private static String role(Authentication authentication) {
        if (authentication == null) {
            throw new SecurityException("Authentication role is required");
        }
        return authentication.getAuthorities().stream()
                .map(authority -> authority.getAuthority())
                .filter(authority -> authority != null && authority.startsWith("ROLE_"))
                .map(authority -> authority.substring("ROLE_".length()))
                .findFirst()
                .orElseThrow(() -> new SecurityException("Authentication role is required"));
    }
}
