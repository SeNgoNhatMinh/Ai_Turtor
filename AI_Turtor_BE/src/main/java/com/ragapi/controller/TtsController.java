package com.ragapi.controller;

import com.ragapi.dto.TtsReadRequest;
import com.ragapi.service.TtsAudioResult;
import com.ragapi.service.TtsService;
import com.ragapi.service.TtsUnavailableException;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/tts")
@RequiredArgsConstructor
@Tag(name = "AI Tutor text-to-speech", description = "NVIDIA Magpie voices and speech synthesis")
public class TtsController {

    private final TtsService service;

    @GetMapping("/voices")
    @Operation(summary = "List Vietnamese NVIDIA voices available to an enrolled student")
    public ResponseEntity<?> voices(
            @RequestParam(required = false) String courseId,
            @RequestParam(required = false) String classId,
            Authentication authentication
    ) {
        try {
            String userId = authenticatedUserId(authentication);
            if (!notBlank(courseId) || !notBlank(classId)) {
                throw new IllegalArgumentException("courseId and classId are both required");
            }
            requireRole(authentication, "ROLE_STUDENT");
            return ResponseEntity.ok(service.listStudentVoices(userId, courseId, classId));
        } catch (TtsUnavailableException e) {
            return error(HttpStatus.SERVICE_UNAVAILABLE, "TTS_UNAVAILABLE", e.getMessage());
        } catch (SecurityException e) {
            return error(HttpStatus.FORBIDDEN, "TTS_FORBIDDEN", e.getMessage());
        } catch (IllegalArgumentException e) {
            return error(HttpStatus.BAD_REQUEST, "INVALID_TTS_REQUEST", e.getMessage());
        }
    }

    @PostMapping(value = {"/synthesize", "/read"}, produces = {"audio/wav", "application/json"})
    @Operation(summary = "Generate speech for one AI Tutor answer")
    public ResponseEntity<?> synthesize(@RequestBody TtsReadRequest request, Authentication authentication) {
        try {
            requireRole(authentication, "ROLE_STUDENT");
            TtsAudioResult result = service.readAiAnswer(request, authenticatedUserId(authentication));
            return ResponseEntity.ok()
                    .contentType(safeMediaType(result.contentType()))
                    .cacheControl(CacheControl.noStore())
                    .header(HttpHeaders.CONTENT_DISPOSITION, "inline; filename=\"" + result.fileName() + "\"")
                    .body(result.bytes());
        } catch (TtsUnavailableException e) {
            return error(HttpStatus.SERVICE_UNAVAILABLE, "TTS_UNAVAILABLE", e.getMessage());
        } catch (SecurityException e) {
            return error(HttpStatus.FORBIDDEN, "TTS_FORBIDDEN", e.getMessage());
        } catch (IllegalArgumentException e) {
            return error(HttpStatus.BAD_REQUEST, "INVALID_TTS_REQUEST", e.getMessage());
        }
    }

    private String authenticatedUserId(Authentication authentication) {
        if (authentication == null || !authentication.isAuthenticated()
                || authentication.getName() == null || authentication.getName().isBlank()) {
            throw new SecurityException("Authentication is required");
        }
        return authentication.getName();
    }

    private void requireRole(Authentication authentication, String role) {
        requireAnyRole(authentication, List.of(role));
    }

    private void requireAnyRole(Authentication authentication, List<String> roles) {
        authenticatedUserId(authentication);
        boolean allowed = authentication.getAuthorities().stream()
                .anyMatch(authority -> roles.contains(authority.getAuthority()));
        if (!allowed) throw new SecurityException("This TTS operation is not allowed for the current role");
    }

    private boolean notBlank(String value) {
        return value != null && !value.isBlank();
    }

    private MediaType safeMediaType(String value) {
        try {
            return value == null ? MediaType.parseMediaType("audio/wav") : MediaType.parseMediaType(value);
        } catch (Exception ignored) {
            return MediaType.parseMediaType("audio/wav");
        }
    }

    private ResponseEntity<Map<String, String>> error(HttpStatus status, String code, String message) {
        return ResponseEntity.status(status).contentType(MediaType.APPLICATION_JSON)
                .body(Map.of("code", code, "error", message, "message", message));
    }
}
