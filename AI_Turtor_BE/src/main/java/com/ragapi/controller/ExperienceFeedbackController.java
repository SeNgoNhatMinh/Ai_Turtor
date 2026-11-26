package com.ragapi.controller;

import com.ragapi.entity.ExperienceFeedback;
import com.ragapi.service.feedback.ExperienceFeedbackService;
import com.ragapi.util.ErrorStatus;
import io.swagger.v3.oas.annotations.Operation;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

/** Experience survey: signed-in users answer once (and may update); admins read the results. */
@Slf4j
@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
public class ExperienceFeedbackController {

    private final ExperienceFeedbackService service;

    @GetMapping("/feedback/me")
    @Operation(summary = "The caller's experience survey answer, if any")
    public ResponseEntity<?> mine(Authentication authentication) {
        ExperienceFeedback mine = service.findMine(userId(authentication));
        return mine == null ? ResponseEntity.ok(Map.of()) : ResponseEntity.ok(mine);
    }

    @PostMapping("/feedback")
    @Operation(summary = "Submit or update the caller's experience survey answer")
    public ResponseEntity<?> submit(@RequestBody ExperienceFeedback input, Authentication authentication) {
        try {
            return ResponseEntity.ok(service.submit(userId(authentication), input));
        } catch (Exception e) {
            log.warn("Experience feedback rejected: {}", e.getMessage());
            return ResponseEntity.status(ErrorStatus.of(e)).body(Map.of("error", e.getMessage()));
        }
    }

    /** Under /api/admin, so SecurityConfig limits it to ADMIN. */
    @GetMapping("/admin/feedback")
    @Operation(summary = "All experience survey answers with averages and counts")
    public ResponseEntity<?> summary() {
        return ResponseEntity.ok(service.summary());
    }

    private static String userId(Authentication authentication) {
        if (authentication == null || authentication.getName() == null || authentication.getName().isBlank()) {
            throw new SecurityException("Login required");
        }
        return authentication.getName();
    }
}
