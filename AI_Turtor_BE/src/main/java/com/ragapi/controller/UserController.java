package com.ragapi.controller;

import com.ragapi.dto.ChangePasswordRequest;
import com.ragapi.dto.UpdateUserProfileRequest;
import com.ragapi.dto.UserLoginRequest;
import com.ragapi.dto.UserLoginResponse;
import com.ragapi.dto.UserRegisterRequest;
import com.ragapi.dto.UserRegisterResponse;
import com.ragapi.entity.User;
import com.ragapi.service.student.UserService;
import com.ragapi.service.notification.RealtimeEventService;
import com.ragapi.service.auth.RefreshTokenCookieService;
import com.ragapi.service.auth.JwtService;
import com.ragapi.service.security.RateLimiter;
import com.ragapi.service.auth.RefreshTokenService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.AllArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CookieValue;
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
    private RefreshTokenService refreshTokenService;
    private RefreshTokenCookieService refreshTokenCookieService;
    private JwtService jwtService;
    private RateLimiter rateLimiter;

    // Password guessing: 10 failures per account or 50 per client address per 15 minutes.
    static final long LOGIN_WINDOW_MS = 15 * 60_000L;
    static final int LOGIN_FAILURES_PER_ACCOUNT = 10;
    static final int LOGIN_FAILURES_PER_IP = 50;

    @PostMapping("/register")
    @Operation(summary = "Register student account")
    public ResponseEntity<?> register(
            @RequestBody UserRegisterRequest request,
            @CookieValue(value = RefreshTokenCookieService.COOKIE_NAME, required = false) String existingRefreshToken
    ) {
        try {
            UserRegisterResponse response = userService.register(request);
            refreshTokenService.revoke(existingRefreshToken);
            RefreshTokenService.SignedInSession session = refreshTokenService.startSession(response.getUserId());
            response.setToken(jwtService.generateToken(response.getUserId(), response.getEmail(),
                    response.getFullName(), response.getRole(), session.sessionId()));
            RefreshTokenService.IssuedRefreshToken refreshToken = session.refreshToken();
            return ResponseEntity.status(HttpStatus.CREATED)
                    .header(HttpHeaders.SET_COOKIE, refreshTokenCookieService.create(refreshToken.value()).toString())
                    .body(response);
        } catch (Exception e) {
            log.error("Error registering user", e);
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(Map.of("error", e.getMessage()));
        }
    }

    @PostMapping("/login")
    @Operation(summary = "Login student or mentor account")
    public ResponseEntity<?> login(
            @RequestBody UserLoginRequest request,
            @CookieValue(value = RefreshTokenCookieService.COOKIE_NAME, required = false) String existingRefreshToken,
            HttpServletRequest httpRequest
    ) {
        String accountKey = "login:account:" + (request.getEmail() == null ? "" : request.getEmail().trim().toLowerCase());
        String ipKey = "login:ip:" + RateLimiter.clientIp(httpRequest);
        if (rateLimiter.count(accountKey, LOGIN_WINDOW_MS) >= LOGIN_FAILURES_PER_ACCOUNT
                || rateLimiter.count(ipKey, LOGIN_WINDOW_MS) >= LOGIN_FAILURES_PER_IP) {
            long retryAfter = Math.max(rateLimiter.retryAfterSeconds(accountKey, LOGIN_WINDOW_MS),
                    rateLimiter.count(ipKey, LOGIN_WINDOW_MS) >= LOGIN_FAILURES_PER_IP
                            ? rateLimiter.retryAfterSeconds(ipKey, LOGIN_WINDOW_MS) : 1);
            return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS)
                    .header(HttpHeaders.RETRY_AFTER, String.valueOf(retryAfter))
                    .body(Map.of("error", "Bạn đã nhập sai quá nhiều lần. Vui lòng thử lại sau "
                            + Math.max(1, (retryAfter + 59) / 60) + " phút.", "code", "TOO_MANY_LOGIN_ATTEMPTS"));
        }
        try {
            UserLoginResponse response = userService.login(request);
            refreshTokenService.revoke(existingRefreshToken);
            // One device per account: this sign-in replaces any other device's session.
            RefreshTokenService.SignedInSession session = refreshTokenService.startSession(response.getUserId());
            response.setToken(jwtService.generateToken(response.getUserId(), response.getEmail(),
                    response.getFullName(), response.getRole(), session.sessionId()));
            RefreshTokenService.IssuedRefreshToken refreshToken = session.refreshToken();
            rateLimiter.reset(accountKey);
            return ResponseEntity.ok()
                    .header(HttpHeaders.SET_COOKIE, refreshTokenCookieService.create(refreshToken.value()).toString())
                    .body(response);
        } catch (Exception e) {
            rateLimiter.record(accountKey, LOGIN_WINDOW_MS);
            rateLimiter.record(ipKey, LOGIN_WINDOW_MS);
            log.warn("Login failed: {}", e.getMessage());
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("error", "Email hoặc mật khẩu không chính xác"));
        }
    }

    @PostMapping("/refresh")
    @Operation(summary = "Rotate refresh token and issue a new access token")
    public ResponseEntity<?> refresh(
            @CookieValue(value = RefreshTokenCookieService.COOKIE_NAME, required = false) String refreshToken
    ) {
        try {
            RefreshTokenService.RefreshedSession session = refreshTokenService.rotate(refreshToken);
            return ResponseEntity.ok()
                    .header(
                            HttpHeaders.SET_COOKIE,
                            refreshTokenCookieService.create(session.refreshToken().value()).toString()
                    )
                    .body(session.response());
        } catch (Exception exception) {
            log.warn("Refresh token rejected: {}", exception.getMessage());
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("error", "Refresh token is invalid or expired"));
        }
    }

    @PostMapping("/logout")
    @Operation(summary = "Revoke the current refresh token")
    public ResponseEntity<Void> logout(
            @CookieValue(value = RefreshTokenCookieService.COOKIE_NAME, required = false) String refreshToken
    ) {
        try {
            refreshTokenService.revoke(refreshToken);
        } catch (Exception exception) {
            log.warn("Could not revoke refresh token during logout: {}", exception.getMessage());
        }
        return ResponseEntity.noContent()
                .header(HttpHeaders.SET_COOKIE, refreshTokenCookieService.clear().toString())
                .build();
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
