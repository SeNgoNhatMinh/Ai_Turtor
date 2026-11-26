package com.ragapi.config;

import com.ragapi.service.auth.ActiveSessionService;
import com.ragapi.service.auth.JwtService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class JwtAuthenticationFilterTest {

    private final ActiveSessionService activeSessions = mock(ActiveSessionService.class);

    @AfterEach
    void clearSecurityContext() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void authenticatesLegacyMentorAsTeacherCompatibleAuthority() throws Exception {
        JwtService jwtService = mock(JwtService.class);
        when(activeSessions.isActive("teacher-1", "session-1")).thenReturn(true);
        when(jwtService.validateAndParse("legacy-token")).thenReturn(Map.of(
                "userId", "teacher-1",
                "role", "MENTOR",
                "sid", "session-1"
        ));

        JwtAuthenticationFilter filter = new JwtAuthenticationFilter(jwtService, activeSessions);
        MockHttpServletRequest request = new MockHttpServletRequest("DELETE", "/api/tutor/escalations/e-1/teacher-inbox");
        request.addHeader("Authorization", "Bearer legacy-token");

        filter.doFilter(request, new MockHttpServletResponse(), (ignoredRequest, ignoredResponse) -> {
            Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
            assertThat(authentication).isNotNull();
            assertThat(authentication.getName()).isEqualTo("teacher-1");
            assertThat(authentication.getAuthorities())
                    .extracting(Object::toString)
                    .containsExactly("ROLE_MENTOR", "ROLE_TEACHER");
        });
    }

    @Test
    void removesRolePrefixBeforeCreatingAuthority() throws Exception {
        JwtService jwtService = mock(JwtService.class);
        when(activeSessions.isActive("teacher-2", "session-2")).thenReturn(true);
        when(jwtService.validateAndParse("prefixed-token")).thenReturn(Map.of(
                "userId", "teacher-2",
                "role", "ROLE_TEACHER",
                "sid", "session-2"
        ));

        JwtAuthenticationFilter filter = new JwtAuthenticationFilter(jwtService, activeSessions);
        MockHttpServletRequest request = new MockHttpServletRequest("DELETE", "/api/tutor/escalations/e-2/teacher-inbox");
        request.addHeader("Authorization", "Bearer prefixed-token");

        filter.doFilter(request, new MockHttpServletResponse(), (ignoredRequest, ignoredResponse) -> {
            Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
            assertThat(authentication.getAuthorities())
                    .extracting(Object::toString)
                    .containsExactly("ROLE_TEACHER");
        });
    }

    @Test
    void tokenOfAReplacedSessionIsNotAuthenticatedAndIsMarked() throws Exception {
        JwtService jwtService = mock(JwtService.class);
        when(jwtService.validateAndParse("old-device-token")).thenReturn(Map.of(
                "userId", "student-1",
                "role", "STUDENT",
                "sid", "old-session"
        ));
        when(activeSessions.isActive("student-1", "old-session")).thenReturn(false);

        JwtAuthenticationFilter filter = new JwtAuthenticationFilter(jwtService, activeSessions);
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/courses");
        request.addHeader("Authorization", "Bearer old-device-token");

        filter.doFilter(request, new MockHttpServletResponse(), (ignoredRequest, ignoredResponse) ->
                assertThat(SecurityContextHolder.getContext().getAuthentication()).isNull());
        assertThat(request.getAttribute(JwtAuthenticationFilter.AUTH_ERROR_ATTRIBUTE))
                .isEqualTo(JwtAuthenticationFilter.SESSION_REPLACED);
    }

    @Test
    void tokenWithoutSessionIdIsRejected() throws Exception {
        JwtService jwtService = mock(JwtService.class);
        when(jwtService.validateAndParse("pre-session-token")).thenReturn(Map.of(
                "userId", "student-1",
                "role", "STUDENT"
        ));

        JwtAuthenticationFilter filter = new JwtAuthenticationFilter(jwtService, new ActiveSessionService(null));
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/courses");
        request.addHeader("Authorization", "Bearer pre-session-token");

        filter.doFilter(request, new MockHttpServletResponse(), (ignoredRequest, ignoredResponse) ->
                assertThat(SecurityContextHolder.getContext().getAuthentication()).isNull());
    }
}
