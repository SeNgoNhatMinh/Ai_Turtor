package com.ragapi.controller;

import com.ragapi.dto.AssignTeachingBehaviorRequest;
import com.ragapi.dto.TeachingBehaviorRequest;
import com.ragapi.dto.TeachingBehaviorTestRequest;
import com.ragapi.service.behavior.AppliedTeachingBehaviorService;
import com.ragapi.service.behavior.BehaviorAccessDeniedException;
import com.ragapi.service.behavior.BehaviorActor;
import com.ragapi.service.behavior.TeachingBehaviorService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.NoSuchElementException;
import java.util.function.Supplier;

/** CRUD for the shared teaching-behavior ("RAG behavior") library. */
@RestController
@RequestMapping("/api/teacher/teaching-behaviors")
@RequiredArgsConstructor
public class TeachingBehaviorController {
    private final TeachingBehaviorService behaviorService;
    private final AppliedTeachingBehaviorService appliedService;

    @GetMapping("/overview")
    public ResponseEntity<?> overview(Authentication authentication) {
        return handle(() -> appliedService.overview(actor(authentication)));
    }

    @GetMapping
    public ResponseEntity<?> list(
            @RequestParam(required = false) String scope,
            @RequestParam(required = false) String courseId,
            @RequestParam(required = false) String domain,
            @RequestParam(required = false) String status,
            @RequestParam(required = false, name = "q") String keyword,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            Authentication authentication) {
        return handle(() -> behaviorService.list(
                scope, courseId, domain, status, keyword, page, size, actor(authentication)));
    }

    @GetMapping("/{id}")
    public ResponseEntity<?> detail(@PathVariable String id, Authentication authentication) {
        return handle(() -> behaviorService.get(id, actor(authentication)));
    }

    @PostMapping
    public ResponseEntity<?> create(@RequestBody TeachingBehaviorRequest request, Authentication authentication) {
        return handle(() -> behaviorService.create(request, actor(authentication)));
    }

    @PutMapping("/{id}")
    public ResponseEntity<?> update(
            @PathVariable String id, @RequestBody TeachingBehaviorRequest request, Authentication authentication) {
        return handle(() -> behaviorService.update(id, request, actor(authentication)));
    }

    /** Turns a retired behavior back on (or retires it) without deleting its history. */
    @PostMapping("/{id}/status")
    @PatchMapping("/{id}/status")
    public ResponseEntity<?> setStatus(
            @PathVariable String id, @RequestBody Map<String, String> body, Authentication authentication) {
        return handle(() -> behaviorService.setStatus(id, body == null ? null : body.get("status"), actor(authentication)));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> retire(@PathVariable String id, Authentication authentication) {
        return handle(() -> behaviorService.retire(id, actor(authentication)));
    }

    @PostMapping("/{id}/assign")
    public ResponseEntity<?> assign(
            @PathVariable String id, @RequestBody AssignTeachingBehaviorRequest request, Authentication authentication) {
        return handle(() -> appliedService.assign(id, request, actor(authentication)));
    }

    @GetMapping("/{id}/assignments")
    public ResponseEntity<?> assignments(@PathVariable String id, Authentication authentication) {
        return handle(() -> appliedService.assignmentsOf(id, actor(authentication)));
    }

    @GetMapping("/{id}/executions")
    public ResponseEntity<?> executions(
            @PathVariable String id,
            @RequestParam(required = false) String courseId,
            @RequestParam(required = false) String studentId,
            @RequestParam(required = false) String status,
            Authentication authentication) {
        return handle(() -> appliedService.listExecutions(
                id, courseId, studentId, status, null, null, actor(authentication)));
    }

    @GetMapping("/{id}/versions")
    public ResponseEntity<?> versions(@PathVariable String id, Authentication authentication) {
        return handle(() -> appliedService.versions(id, actor(authentication)));
    }

    @PostMapping("/{id}/rollback")
    public ResponseEntity<?> rollback(
            @PathVariable String id, @RequestBody Map<String, Integer> body, Authentication authentication) {
        int version = body == null || body.get("version") == null ? 0 : body.get("version");
        return handle(() -> appliedService.rollback(id, version, actor(authentication)));
    }

    @PostMapping("/{id}/test")
    public ResponseEntity<?> test(
            @PathVariable String id, @RequestBody(required = false) TeachingBehaviorTestRequest request,
            Authentication authentication) {
        return handle(() -> appliedService.testBehavior(id, request, actor(authentication)));
    }

    static ResponseEntity<?> handle(Supplier<?> action) {
        try {
            return ResponseEntity.ok(action.get());
        } catch (NoSuchElementException error) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", error.getMessage()));
        } catch (BehaviorAccessDeniedException error) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("error", error.getMessage()));
        } catch (IllegalArgumentException error) {
            return ResponseEntity.badRequest().body(Map.of("error", String.valueOf(error.getMessage())));
        }
    }

    static BehaviorActor actor(Authentication authentication) {
        if (authentication == null) throw new BehaviorAccessDeniedException("Requester is not authenticated");
        String role = authentication.getAuthorities().stream()
                .map(authority -> authority.getAuthority())
                .filter(value -> value != null && value.startsWith("ROLE_"))
                .map(value -> value.substring("ROLE_".length()))
                .findFirst().orElse(null);
        return new BehaviorActor(authentication.getName(), authentication.getName(), role);
    }
}
