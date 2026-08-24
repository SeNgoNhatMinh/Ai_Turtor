package com.ragapi.config;

import com.ragapi.service.JwtService;
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

    @AfterEach
    void clearSecurityContext() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void authenticatesLegacyMentorAsTeacherCompatibleAuthority() throws Exception {
        JwtService jwtService = mock(JwtService.class);
        when(jwtService.validateAndParse("legacy-token")).thenReturn(Map.of(
                "userId", "teacher-1",
                "role", "MENTOR"
        ));

        JwtAuthenticationFilter filter = new JwtAuthenticationFilter(jwtService);
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
        when(jwtService.validateAndParse("prefixed-token")).thenReturn(Map.of(
                "userId", "teacher-2",
                "role", "ROLE_TEACHER"
        ));

        JwtAuthenticationFilter filter = new JwtAuthenticationFilter(jwtService);
        MockHttpServletRequest request = new MockHttpServletRequest("DELETE", "/api/tutor/escalations/e-2/teacher-inbox");
        request.addHeader("Authorization", "Bearer prefixed-token");

        filter.doFilter(request, new MockHttpServletResponse(), (ignoredRequest, ignoredResponse) -> {
            Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
            assertThat(authentication.getAuthorities())
                    .extracting(Object::toString)
                    .containsExactly("ROLE_TEACHER");
        });
    }
}
