package com.ragapi.controller;

import com.ragapi.dto.UserLoginRequest;
import com.ragapi.dto.UserLoginResponse;
import com.ragapi.service.auth.InvalidRefreshTokenException;
import com.ragapi.service.auth.JwtService;
import com.ragapi.service.security.RateLimiter;
import com.ragapi.service.notification.RealtimeEventService;
import com.ragapi.service.auth.RefreshTokenCookieService;
import com.ragapi.service.auth.RefreshTokenService;
import com.ragapi.service.student.UserService;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.mock.web.MockHttpServletRequest;

import java.time.Instant;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class UserControllerRefreshTokenTest {

    private final UserService userService = mock(UserService.class);
    private final RefreshTokenService refreshTokenService = mock(RefreshTokenService.class);
    private final JwtService jwtService = mock(JwtService.class);
    private final UserController controller = new UserController(
            userService,
            mock(RealtimeEventService.class),
            refreshTokenService,
            new RefreshTokenCookieService(true, 30),
            jwtService,
            new RateLimiter()
    );

    @Test
    void loginReturnsAccessTokenAndHttpOnlyRefreshCookie() {
        UserLoginRequest request = new UserLoginRequest();
        request.setEmail("student@example.com");
        request.setPassword("secret123");
        UserLoginResponse login = UserLoginResponse.builder()
                .userId("student-1")
                .email(request.getEmail())
                .role("STUDENT")
                .token("access-token")
                .build();
        when(userService.login(request)).thenReturn(login);
        when(refreshTokenService.startSession("student-1")).thenReturn(new RefreshTokenService.SignedInSession(
                "session-1",
                new RefreshTokenService.IssuedRefreshToken("refresh-token", Instant.now().plusSeconds(3600))
        ));
        when(jwtService.generateToken("student-1", "student@example.com", null, "STUDENT", "session-1"))
                .thenReturn("session-bound-token");

        ResponseEntity<?> response = controller.login(request, null, new MockHttpServletRequest());

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).isEqualTo(login);
        assertThat(login.getToken()).isEqualTo("session-bound-token");
        assertThat(response.getHeaders().getFirst(HttpHeaders.SET_COOKIE))
                .contains("ai_tutor_refresh=refresh-token")
                .contains("Path=/api/users")
                .contains("Secure")
                .contains("HttpOnly")
                .contains("SameSite=Lax");
    }

    @Test
    void rejectedRefreshDoesNotOverwriteCookieRotatedByAnotherTab() {
        when(refreshTokenService.rotate("bad-token")).thenThrow(new InvalidRefreshTokenException());

        ResponseEntity<?> response = controller.refresh("bad-token");

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
        assertThat(response.getHeaders().getFirst(HttpHeaders.SET_COOKIE)).isNull();
    }

    @Test
    void tenFailedLoginsLockTheAccountForAWhile() {
        UserLoginRequest request = new UserLoginRequest();
        request.setEmail("victim@example.com");
        request.setPassword("guess");
        when(userService.login(request)).thenThrow(new RuntimeException("Email hoặc Password không chính xác"));

        for (int i = 0; i < 10; i++) {
            assertThat(controller.login(request, null, new MockHttpServletRequest()).getStatusCode())
                    .isEqualTo(HttpStatus.UNAUTHORIZED);
        }
        ResponseEntity<?> blocked = controller.login(request, null, new MockHttpServletRequest());

        assertThat(blocked.getStatusCode()).isEqualTo(HttpStatus.TOO_MANY_REQUESTS);
        assertThat(blocked.getHeaders().getFirst(HttpHeaders.RETRY_AFTER)).isNotBlank();
    }
}
