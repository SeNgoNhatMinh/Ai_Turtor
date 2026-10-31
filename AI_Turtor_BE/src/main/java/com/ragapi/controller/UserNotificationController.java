package com.ragapi.controller;

import com.ragapi.entity.UserNotification;
import com.ragapi.service.UserNotificationService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/notifications")
@Tag(name = "Notifications", description = "Persisted notifications for the signed-in user")
public class UserNotificationController {
    private final UserNotificationService notifications;

    @GetMapping
    @Operation(summary = "List the signed-in user's notifications, newest first")
    public ResponseEntity<?> list(Authentication authentication) {
        String userId = userId(authentication);
        if (userId == null) return unauthorized();
        List<UserNotification> items = notifications.listForUser(userId);
        return ResponseEntity.ok(Map.of(
                "notifications", items,
                "unreadCount", notifications.unreadCount(userId)
        ));
    }

    @PostMapping("/{id}/read")
    @Operation(summary = "Mark one notification as read")
    public ResponseEntity<?> markRead(@PathVariable String id, Authentication authentication) {
        String userId = userId(authentication);
        if (userId == null) return unauthorized();
        try {
            return ResponseEntity.ok(notifications.markRead(userId, id));
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.badRequest().body(Map.of("error", ex.getMessage()));
        } catch (SecurityException ex) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("error", ex.getMessage()));
        }
    }

    @PostMapping("/read")
    @Operation(summary = "Mark every notification for the signed-in user as read")
    public ResponseEntity<?> markAllRead(Authentication authentication) {
        String userId = userId(authentication);
        if (userId == null) return unauthorized();
        return ResponseEntity.ok(Map.of("updated", notifications.markAllRead(userId)));
    }

    private static String userId(Authentication authentication) {
        if (authentication == null || authentication.getName() == null || authentication.getName().isBlank()) {
            return null;
        }
        return authentication.getName();
    }

    private static ResponseEntity<Map<String, String>> unauthorized() {
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("error", "Unauthorized"));
    }
}
