package com.ragapi.controller;

import com.ragapi.dto.OpenTutorSessionRequest;
import com.ragapi.dto.PedagogicalDirectiveRequest;
import com.ragapi.dto.UpdateTutorSessionRequest;
import com.ragapi.entity.TutorSession;
import com.ragapi.entity.TutorSessionSummary;
import com.ragapi.service.AccessGuardService;
import com.ragapi.service.PedagogicalDirectiveService;
import com.ragapi.service.TutorSessionService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/tutor")
@RequiredArgsConstructor
public class TutorSessionController {
    private final TutorSessionService sessionService;
    private final PedagogicalDirectiveService directiveService;
    private final AccessGuardService accessGuard;

    @PostMapping("/sessions/open")
    public ResponseEntity<?> open(
            @RequestBody OpenTutorSessionRequest request,
            Authentication authentication
    ) {
        try {
            accessGuard.allowEnrolledStudentSelfOrAdmin(
                    requesterId(authentication), requesterRole(authentication), request.getStudentId(),
                    request.getCourseId(), request.getClassId());
            return ResponseEntity.ok(sessionService.openOrResume(request));
        } catch (IllegalArgumentException error) {
            return ResponseEntity.badRequest().body(Map.of("error", error.getMessage()));
        }
    }

    @GetMapping("/students/{studentId}/courses/{courseId}/sessions")
    public ResponseEntity<?> studentSessions(
            @PathVariable String studentId,
            @PathVariable String courseId,
            Authentication authentication
    ) {
        try {
            accessGuard.allowStudentSelfOrAdmin(
                    requesterId(authentication), requesterRole(authentication), studentId);
            return ResponseEntity.ok(Map.of("sessions", sessionService.listStudentSessions(studentId, courseId)));
        } catch (IllegalArgumentException error) {
            return ResponseEntity.badRequest().body(Map.of("error", error.getMessage()));
        }
    }

    @PatchMapping("/sessions/{sessionId}")
    public ResponseEntity<?> update(
            @PathVariable String sessionId,
            @RequestBody UpdateTutorSessionRequest request,
            Authentication authentication
    ) {
        try {
            TutorSession session = sessionService.getSession(sessionId);
            accessGuard.allowEnrolledStudentSelfOrAdmin(
                    requesterId(authentication), requesterRole(authentication), session.getStudentId(),
                    session.getCourseId(), session.getClassId());
            return ResponseEntity.ok(sessionService.update(sessionId, request));
        } catch (IllegalArgumentException error) {
            return ResponseEntity.badRequest().body(Map.of("error", error.getMessage()));
        }
    }

    @PostMapping("/sessions/{sessionId}/close")
    public ResponseEntity<?> close(@PathVariable String sessionId, Authentication authentication) {
        try {
            TutorSession session = sessionService.getSession(sessionId);
            accessGuard.allowEnrolledStudentSelfOrAdmin(
                    requesterId(authentication), requesterRole(authentication), session.getStudentId(),
                    session.getCourseId(), session.getClassId());
            return ResponseEntity.ok(sessionService.close(sessionId));
        } catch (IllegalArgumentException error) {
            return ResponseEntity.badRequest().body(Map.of("error", error.getMessage()));
        }
    }

    @GetMapping("/teachers/{teacherId}/courses/{courseId}/classes/{classId}/session-summaries")
    public ResponseEntity<?> teacherSummaries(
            @PathVariable String teacherId,
            @PathVariable String courseId,
            @PathVariable String classId,
            Authentication authentication
    ) {
        try {
            requireSameRequesterOrAdmin(teacherId, authentication);
            accessGuard.allowTeacherForClassOrAdmin(
                    requesterId(authentication), requesterRole(authentication), courseId, classId);
            return ResponseEntity.ok(Map.of(
                    "summaries", sessionService.listTeacherSummaries(courseId, classId)));
        } catch (IllegalArgumentException error) {
            return ResponseEntity.badRequest().body(Map.of("error", error.getMessage()));
        }
    }

    @GetMapping("/teachers/{teacherId}/session-summaries/{summaryId}/transcript")
    public ResponseEntity<?> transcript(
            @PathVariable String teacherId,
            @PathVariable String summaryId,
            Authentication authentication
    ) {
        try {
            requireSameRequesterOrAdmin(teacherId, authentication);
            TutorSessionSummary summary = sessionService.getSummary(summaryId);
            accessGuard.allowTeacherForStudentTranscript(
                    requesterId(authentication), requesterRole(authentication),
                    summary.getStudentId(), summary.getCourseId(), summary.getClassId());
            return ResponseEntity.ok(Map.of(
                    "summary", summary,
                    "messages", sessionService.getSummaryTranscript(summaryId)));
        } catch (IllegalArgumentException error) {
            return ResponseEntity.badRequest().body(Map.of("error", error.getMessage()));
        }
    }

    @GetMapping("/teachers/{teacherId}/courses/{courseId}/classes/{classId}/directives")
    public ResponseEntity<?> directives(
            @PathVariable String teacherId,
            @PathVariable String courseId,
            @PathVariable String classId,
            Authentication authentication
    ) {
        try {
            requireSameRequesterOrAdmin(teacherId, authentication);
            accessGuard.allowTeacherForClassOrAdmin(
                    requesterId(authentication), requesterRole(authentication), courseId, classId);
            return ResponseEntity.ok(Map.of("directives", directiveService.listForClass(courseId, classId)));
        } catch (IllegalArgumentException error) {
            return ResponseEntity.badRequest().body(Map.of("error", error.getMessage()));
        }
    }

    @PostMapping("/teachers/{teacherId}/directives")
    public ResponseEntity<?> createDirective(
            @PathVariable String teacherId,
            @RequestBody PedagogicalDirectiveRequest request,
            Authentication authentication
    ) {
        try {
            requireSameRequesterOrAdmin(teacherId, authentication);
            accessGuard.allowTeacherForClassOrAdmin(
                    requesterId(authentication), requesterRole(authentication),
                    request.getCourseId(), request.getClassId());
            return ResponseEntity.ok(directiveService.createDraft(
                    request, teacherId, authentication == null ? null : authentication.getName()));
        } catch (IllegalArgumentException error) {
            return ResponseEntity.badRequest().body(Map.of("error", error.getMessage()));
        }
    }

    @PostMapping("/teachers/{teacherId}/directives/{directiveId}/confirm")
    public ResponseEntity<?> confirmDirective(
            @PathVariable String teacherId,
            @PathVariable String directiveId,
            Authentication authentication
    ) {
        try {
            requireSameRequesterOrAdmin(teacherId, authentication);
            return ResponseEntity.ok(directiveService.confirm(directiveId, teacherId));
        } catch (IllegalArgumentException error) {
            return ResponseEntity.badRequest().body(Map.of("error", error.getMessage()));
        }
    }

    @PostMapping("/teachers/{teacherId}/directives/{directiveId}/archive")
    public ResponseEntity<?> archiveDirective(
            @PathVariable String teacherId,
            @PathVariable String directiveId,
            Authentication authentication
    ) {
        try {
            requireSameRequesterOrAdmin(teacherId, authentication);
            return ResponseEntity.ok(directiveService.archive(directiveId, teacherId));
        } catch (IllegalArgumentException error) {
            return ResponseEntity.badRequest().body(Map.of("error", error.getMessage()));
        }
    }

    private void requireSameRequesterOrAdmin(String teacherId, Authentication authentication) {
        String role = requesterRole(authentication);
        if (!accessGuard.isAdmin(role) && !teacherId.equals(requesterId(authentication))) {
            throw new IllegalArgumentException("Teacher can only access their own tutoring classes");
        }
    }

    private String requesterId(Authentication authentication) {
        return authentication == null ? null : authentication.getName();
    }

    private String requesterRole(Authentication authentication) {
        if (authentication == null) return null;
        return authentication.getAuthorities().stream()
                .map(authority -> authority.getAuthority())
                .filter(value -> value != null && value.startsWith("ROLE_"))
                .map(value -> value.substring("ROLE_".length()))
                .findFirst().orElse(null);
    }
}
