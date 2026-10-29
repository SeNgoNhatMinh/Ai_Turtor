package com.ragapi.controller;

import com.ragapi.dto.UserLoginRequest;
import com.ragapi.dto.UserLoginResponse;
import com.ragapi.service.InvalidRefreshTokenException;
import com.ragapi.service.RealtimeEventService;
import com.ragapi.service.RefreshTokenCookieService;
import com.ragapi.service.RefreshTokenService;
import com.ragapi.service.UserService;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

import java.time.Instant;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class UserControllerRefreshTokenTest {

    private final UserService userService = mock(UserService.class);
    private final RefreshTokenService refreshTokenService = mock(RefreshTokenService.class);
    private final UserController controller = new UserController(
            userService,
            mock(RealtimeEventService.class),
            refreshTokenService,
            new RefreshTokenCookieService(true, 30)
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
        when(refreshTokenService.issue("student-1")).thenReturn(
                new RefreshTokenService.IssuedRefreshToken("refresh-token", Instant.now().plusSeconds(3600))
        );

        ResponseEntity<?> response = controller.login(request, null);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).isEqualTo(login);
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
}
