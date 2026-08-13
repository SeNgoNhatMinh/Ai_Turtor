package com.ragapi.controller;

import com.ragapi.dto.ChangePasswordRequest;
import com.ragapi.dto.UpdateUserProfileRequest;
import com.ragapi.dto.UserLoginRequest;
import com.ragapi.dto.UserLoginResponse;
import com.ragapi.dto.UserRegisterRequest;
import com.ragapi.dto.UserRegisterResponse;
import com.ragapi.entity.User;
import com.ragapi.service.UserService;
import com.ragapi.service.RealtimeEventService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.AllArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.LinkedHashMap;
import java.util.Map;

@Slf4j
@RestController
@RequestMapping("/api/users")
@AllArgsConstructor
@Tag(name = "User Profile", description = "Student and mentor authentication/profile APIs")
public class UserController {

    private UserService userService;
    private RealtimeEventService realtimeEventService;

    @PostMapping("/register")
    @Operation(summary = "Register student account")
    public ResponseEntity<?> register(@RequestBody UserRegisterRequest request) {
        try {
            UserRegisterResponse response = userService.register(request);
            return ResponseEntity.status(HttpStatus.CREATED).body(response);
        } catch (Exception e) {
            log.error("Error registering user", e);
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(Map.of("error", e.getMessage()));
        }
    }

    @PostMapping("/login")
    @Operation(summary = "Login student or mentor account")
    public ResponseEntity<?> login(@RequestBody UserLoginRequest request) {
        try {
            UserLoginResponse response = userService.login(request);
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            log.error("Error logging in user", e);
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("error", e.getMessage()));
        }
    }


    @PutMapping("/{userId}/password")
    @Operation(summary = "Change password for student, mentor, or admin account")
    public ResponseEntity<?> changePassword(
            @PathVariable String userId,
            @RequestBody ChangePasswordRequest request
    ) {
        try {
            userService.changePassword(userId, request.getCurrentPassword(), request.getNewPassword());
            return ResponseEntity.ok(Map.of("message", "Password changed successfully"));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        } catch (Exception e) {
            log.error("Error changing password", e);
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("error", e.getMessage()));
        }
    }
    @GetMapping("/profile")
    @Operation(summary = "Get user profile by query parameter")
    public ResponseEntity<?> getProfile(@RequestParam String userId) {
        return getProfileById(userId);
    }

    @GetMapping("/{userId}/profile")
    @Operation(summary = "Get user profile")
    public ResponseEntity<?> getProfileById(@PathVariable String userId) {
        try {
            User user = userService.getUserById(userId);
            return ResponseEntity.ok(toProfileResponse(user));
        } catch (Exception e) {
            log.error("Error fetching profile", e);
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(Map.of("error", e.getMessage()));
        }
    }

    @PutMapping("/{userId}/profile")
    @Operation(summary = "Update user profile")
    public ResponseEntity<?> updateProfile(
            @PathVariable String userId,
            @RequestBody UpdateUserProfileRequest request
    ) {
        try {
            User user = userService.updateProfile(userId, request);
            Map<String, Object> profile = toProfileResponse(user);
            realtimeEventService.publishToUser(
                    user.getId(),
                    "PROFILE_UPDATED",
                    "USER_PROFILE",
                    user.getId(),
                    "UPDATED",
                    profile
            );
            return ResponseEntity.ok(profile);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        } catch (Exception e) {
            log.error("Error updating profile", e);
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(Map.of("error", e.getMessage()));
        }
    }

    private Map<String, Object> toProfileResponse(User user) {
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("userId", user.getId());
        response.put("email", user.getEmail());
        response.put("fullName", user.getFullName());
        response.put("phone", user.getPhone());
        response.put("avatarUrl", user.getAvatarUrl());
        response.put("role", user.getRole());
        response.put("bio", user.getBio());
        response.put("address", user.getAddress());
        response.put("city", user.getCity());
        response.put("isActive", user.getIsActive());
        response.put("isEmailVerified", user.getIsEmailVerified());
        response.put("createdAt", user.getCreatedAt());
        response.put("updatedAt", user.getUpdatedAt());
        response.put("lastLoginAt", user.getLastLoginAt());
        return response;
    }
}
