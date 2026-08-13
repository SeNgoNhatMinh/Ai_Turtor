package com.ragapi.controller;

import com.ragapi.dto.AdminMentorUpdateRequest;
import com.ragapi.dto.AdminTeacherRoleUpdateRequest;
import com.ragapi.dto.AdminUserUpdateRequest;
import com.ragapi.dto.AssignSubscriptionRequest;
import com.ragapi.dto.SubscriptionPlanRequest;
import com.ragapi.dto.SubscriptionStatusUpdateRequest;
import com.ragapi.entity.Mentor;
import com.ragapi.entity.QuestionEscalation;
import com.ragapi.entity.SubscriptionPlan;
import com.ragapi.entity.User;
import com.ragapi.entity.UserSubscription;
import com.ragapi.service.AdminDashboardService;
import com.ragapi.service.AdminAiLogService;
import com.ragapi.service.SubscriptionService;
import lombok.AllArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@Slf4j
@RestController
@RequestMapping("/api/admin")
@AllArgsConstructor
public class AdminDashboardController {
    private final AdminDashboardService adminDashboardService;
    private final SubscriptionService subscriptionService;
    private final AdminAiLogService adminAiLogService;

    @GetMapping("/ai-logs")
    public ResponseEntity<?> listAiLogs(@RequestParam(value = "studentId", required = false) String studentId,
            @RequestParam(value = "courseId", required = false) String courseId,
            @RequestParam(value = "q", required = false) String query,
            @RequestParam(value = "from", required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime from,
            @RequestParam(value = "to", required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime to) {
        var logs = adminAiLogService.list(studentId, courseId, query, from, to);
        return ResponseEntity.ok(Map.of("count", logs.size(), "summary", adminAiLogService.summary(logs), "logs", logs));
    }

    @GetMapping("/dashboard/stats")
    public ResponseEntity<?> getDashboardStats() {
        try {
            return ResponseEntity.ok(adminDashboardService.getDashboardStats());
        } catch (Exception e) {
            log.error("Error fetching dashboard stats", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", e.getMessage()));
        }
    }

    @GetMapping("/users")
    public ResponseEntity<?> listUsers(
            @RequestParam(value = "q", required = false) String query,
            @RequestParam(value = "role", required = false) String role,
            @RequestParam(value = "active", required = false) Boolean active) {
        try {
            List<User> users = adminDashboardService.filterUsers(query, role, active);
            return ResponseEntity.ok(Map.of("count", users.size(), "users", users));
        } catch (Exception e) {
            log.error("Error listing users", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", e.getMessage()));
        }
    }

    @DeleteMapping("/users/{userId}")
    public ResponseEntity<?> deleteUser(@PathVariable String userId) {
        try {
            adminDashboardService.deleteUser(userId);
            return ResponseEntity.ok(Map.of("status", "DELETED", "userId", userId));
        } catch (Exception e) {
            log.error("Error deleting user", e);
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(Map.of("error", e.getMessage()));
        }
    }

    @PatchMapping("/users/{userId}")
    public ResponseEntity<?> updateUser(@PathVariable String userId, @RequestBody AdminUserUpdateRequest request) {
        try {
            User user = adminDashboardService.updateUser(userId, request);
            return ResponseEntity.ok(user);
        } catch (Exception e) {
            log.error("Error updating user", e);
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(Map.of("error", e.getMessage()));
        }
    }

    @GetMapping("/mentors")
    public ResponseEntity<?> listMentors(
            @RequestParam(value = "q", required = false) String query,
            @RequestParam(value = "active", required = false) Boolean active,
            @RequestParam(value = "verified", required = false) Boolean verified,
            @RequestParam(value = "city", required = false) String city) {
        try {
            List<Mentor> mentors = adminDashboardService.filterMentors(query, active, verified, city);
            return ResponseEntity.ok(Map.of("count", mentors.size(), "mentors", mentors));
        } catch (Exception e) {
            log.error("Error listing mentors", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", e.getMessage()));
        }
    }

    @DeleteMapping("/mentors/{mentorId}")
    public ResponseEntity<?> deleteMentor(@PathVariable String mentorId) {
        try {
            adminDashboardService.deleteMentor(mentorId);
            return ResponseEntity.ok(Map.of("status", "DELETED", "mentorId", mentorId));
        } catch (Exception e) {
            log.error("Error deleting mentor", e);
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(Map.of("error", e.getMessage()));
        }
    }

    @PatchMapping("/mentors/{mentorId}")
    public ResponseEntity<?> updateMentor(@PathVariable String mentorId,
                                              @RequestBody AdminMentorUpdateRequest request) {
        try {
            Mentor mentor = adminDashboardService.updateMentor(mentorId, request);
            return ResponseEntity.ok(mentor);
        } catch (Exception e) {
            log.error("Error updating mentor", e);
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(Map.of("error", e.getMessage()));
        }
    }

    @PatchMapping("/teachers/{teacherId}/role")
    public ResponseEntity<?> updateTeacherRole(
            @PathVariable String teacherId,
            @RequestBody AdminTeacherRoleUpdateRequest request) {
        try {
            return ResponseEntity.ok(adminDashboardService.updateTeacherRole(teacherId, request));
        } catch (Exception e) {
            log.error("Error updating teacher role", e);
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(Map.of("error", e.getMessage()));
        }
    }

    @GetMapping("/mentor-escalations")
    public ResponseEntity<?> listMentorEscalations(
            @RequestParam(value = "status", required = false) String status,
            @RequestParam(value = "userId", required = false) String userId,
            @RequestParam(value = "mentorId", required = false) String mentorId,
            @RequestParam(value = "from", required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime from,
            @RequestParam(value = "to", required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime to) {
        try {
            List<QuestionEscalation> escalations = adminDashboardService
                    .filterMentorEscalations(status, userId, mentorId, from, to);
            return ResponseEntity.ok(Map.of("count", escalations.size(), "escalations", escalations));
        } catch (Exception e) {
            log.error("Error listing escalations", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", e.getMessage()));
        }
    }

    @DeleteMapping("/mentor-escalations/{escalationId}")
    public ResponseEntity<?> deleteMentorEscalation(@PathVariable String escalationId) {
        try {
            adminDashboardService.deleteMentorEscalation(escalationId);
            return ResponseEntity.ok(Map.of("status", "DELETED", "escalationId", escalationId));
        } catch (Exception e) {
            log.error("Error deleting mentor escalation", e);
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(Map.of("error", e.getMessage()));
        }
    }

    @GetMapping("/subscription-plans")
    public ResponseEntity<?> listPlans(@RequestParam(value = "includeInactive", required = false) Boolean includeInactive) {
        try {
            List<SubscriptionPlan> plans = adminDashboardService.filterPlans(includeInactive);
            return ResponseEntity.ok(Map.of("count", plans.size(), "plans", plans));
        } catch (Exception e) {
            log.error("Error listing subscription plans", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", e.getMessage()));
        }
    }

    @DeleteMapping("/subscription-plans/{planId}")
    public ResponseEntity<?> deletePlan(@PathVariable String planId) {
        try {
            adminDashboardService.deletePlan(planId);
            return ResponseEntity.ok(Map.of("status", "DELETED", "planId", planId));
        } catch (Exception e) {
            log.error("Error deleting plan", e);
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(Map.of("error", e.getMessage()));
        }
    }

    @PutMapping("/subscription-plans/{planId}")
    public ResponseEntity<?> updatePlan(@PathVariable String planId, @RequestBody SubscriptionPlanRequest request) {
        try {
            SubscriptionPlan plan = subscriptionService.updatePlan(planId, request);
            return ResponseEntity.ok(plan);
        } catch (Exception e) {
            log.error("Error updating plan", e);
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(Map.of("error", e.getMessage()));
        }
    }

    @GetMapping("/subscriptions")
    public ResponseEntity<?> listSubscriptions(
            @RequestParam(value = "userId", required = false) String userId,
            @RequestParam(value = "status", required = false) String status,
            @RequestParam(value = "planCode", required = false) String planCode,
            @RequestParam(value = "activeOnly", required = false) Boolean activeOnly) {
        try {
            List<UserSubscription> subscriptions = adminDashboardService
                    .filterSubscriptions(userId, status, planCode, activeOnly);
            return ResponseEntity.ok(Map.of("count", subscriptions.size(), "subscriptions", subscriptions));
        } catch (Exception e) {
            log.error("Error listing subscriptions", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", e.getMessage()));
        }
    }

    @DeleteMapping("/subscriptions/{subscriptionId}")
    public ResponseEntity<?> deleteSubscription(@PathVariable String subscriptionId) {
        try {
            adminDashboardService.deleteSubscription(subscriptionId);
            return ResponseEntity.ok(Map.of("status", "DELETED", "subscriptionId", subscriptionId));
        } catch (Exception e) {
            log.error("Error deleting subscription", e);
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(Map.of("error", e.getMessage()));
        }
    }

    @PostMapping("/subscriptions/assign")
    public ResponseEntity<?> assignSubscription(@RequestBody AssignSubscriptionRequest request) {
        try {
            UserSubscription subscription = subscriptionService.assignPlanToUser(request);
            return ResponseEntity.ok(subscription);
        } catch (Exception e) {
            log.error("Error assigning subscription", e);
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(Map.of("error", e.getMessage()));
        }
    }

    @PatchMapping("/subscriptions/{subscriptionId}/status")
    public ResponseEntity<?> updateSubscriptionStatus(@PathVariable String subscriptionId,
                                                      @RequestBody SubscriptionStatusUpdateRequest request) {
        try {
            UserSubscription subscription = subscriptionService.updateSubscriptionStatus(subscriptionId, request);
            return ResponseEntity.ok(subscription);
        } catch (Exception e) {
            log.error("Error updating subscription status", e);
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(Map.of("error", e.getMessage()));
        }
    }
}
