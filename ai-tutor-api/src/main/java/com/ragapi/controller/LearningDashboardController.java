package com.ragapi.controller;

import com.ragapi.service.AccessGuardService;
import com.ragapi.service.LearningDashboardService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.AllArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@Slf4j
@RestController
@RequestMapping("/api")
@AllArgsConstructor
@Tag(name = "Learning Dashboards", description = "Student and teacher dashboard APIs")
public class LearningDashboardController {

    private final LearningDashboardService dashboardService;
    private final AccessGuardService accessGuardService;

    @GetMapping({"/students/{studentId}/dashboard", "/dashboards/students/{studentId}"})
    @Operation(summary = "Get student dashboard")
    public ResponseEntity<?> getStudentDashboard(
            @PathVariable String studentId,
            @RequestParam(value = "courseId", required = false) String courseId,
            @RequestParam(value = "requesterId", required = false) String requesterId,
            @RequestParam(value = "requesterRole", required = false) String requesterRole
    ) {
        try {
            accessGuardService.allowStudentSelfOrAdmin(requesterId, requesterRole, studentId);
            return ResponseEntity.ok(dashboardService.buildStudentDashboard(studentId, courseId));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("error", e.getMessage()));
        } catch (Exception e) {
            log.error("Error building student dashboard", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(Map.of("error", e.getMessage()));
        }
    }

    @GetMapping({"/mentors/{teacherId}/dashboard", "/teachers/{teacherId}/dashboard", "/dashboards/teachers/{teacherId}"})
    @Operation(summary = "Get teacher or mentor dashboard")
    public ResponseEntity<?> getTeacherDashboard(
            @PathVariable String teacherId,
            @RequestParam(value = "courseId", required = false) String courseId,
            @RequestParam(value = "classId", required = false) String classId,
            @RequestParam(value = "requesterId", required = false) String requesterId,
            @RequestParam(value = "requesterRole", required = false) String requesterRole
    ) {
        try {
            if (requesterId != null || requesterRole != null) {
                if (!accessGuardService.isAdmin(requesterRole) && !teacherId.equals(requesterId)) {
                    return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("error", "Requester is not this teacher"));
                }
            }
            return ResponseEntity.ok(dashboardService.buildTeacherDashboard(teacherId, courseId, classId));
        } catch (Exception e) {
            log.error("Error building teacher dashboard", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(Map.of("error", e.getMessage()));
        }
    }

    @GetMapping({"/mentors/{teacherId}/escalations/inbox", "/teachers/{teacherId}/escalations/inbox", "/tutor/escalations/teachers/{teacherId}"})
    @Operation(summary = "Get teacher escalation inbox")
    public ResponseEntity<?> getTeacherEscalationInbox(
            @PathVariable String teacherId,
            @RequestParam(value = "status", required = false) String status,
            @RequestParam(value = "q", required = false) String query,
            @RequestParam(value = "requesterId", required = false) String requesterId,
            @RequestParam(value = "requesterRole", required = false) String requesterRole
    ) {
        try {
            if (requesterId != null || requesterRole != null) {
                if (!accessGuardService.isAdmin(requesterRole) && !teacherId.equals(requesterId)) {
                    return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("error", "Requester is not this teacher"));
                }
            }
            var escalations = dashboardService.listTeacherEscalationInbox(teacherId, status, query);
            return ResponseEntity.ok(Map.of("teacherId", teacherId, "count", escalations.size(), "escalations", escalations));
        } catch (Exception e) {
            log.error("Error listing teacher escalation inbox", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(Map.of("error", e.getMessage()));
        }
    }
}
