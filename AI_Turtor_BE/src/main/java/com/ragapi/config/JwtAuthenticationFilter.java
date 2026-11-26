package com.ragapi.config;

import com.ragapi.service.auth.ActiveSessionService;
import com.ragapi.service.auth.JwtService;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@Component
@RequiredArgsConstructor
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    /** Request attribute read by the 401 entry point to tell the client why. */
    public static final String AUTH_ERROR_ATTRIBUTE = "ai-tutor.auth-error";
    public static final String SESSION_REPLACED = "SESSION_REPLACED";

    private final JwtService jwtService;
    private final ActiveSessionService activeSessionService;

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {
        String header = request.getHeader("Authorization");
        if (header == null || !header.startsWith("Bearer ")) {
            filterChain.doFilter(request, response);
            return;
        }

        try {
            Map<String, Object> claims = jwtService.validateAndParse(header.substring(7));
            String userId = String.valueOf(claims.get("userId"));
            Object sessionId = claims.get("sid");
            if (!activeSessionService.isActive(userId, sessionId == null ? null : String.valueOf(sessionId))) {
                // The account signed in on another device (one device per account). Public
                // endpoints such as /api/users/login still go through; protected ones get 401.
                SecurityContextHolder.clearContext();
                request.setAttribute(AUTH_ERROR_ATTRIBUTE, SESSION_REPLACED);
                filterChain.doFilter(request, response);
                return;
            }
            String role = normalizeRole(claims.get("role"));
            List<SimpleGrantedAuthority> authorities = new ArrayList<>();
            authorities.add(new SimpleGrantedAuthority("ROLE_" + role));
            if ("MENTOR".equals(role)) {
                authorities.add(new SimpleGrantedAuthority("ROLE_TEACHER"));
            }
            UsernamePasswordAuthenticationToken authentication = new UsernamePasswordAuthenticationToken(
                    userId,
                    null,
                    List.copyOf(authorities)
            );
            authentication.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));
            SecurityContextHolder.getContext().setAuthentication(authentication);
        } catch (Exception ex) {
            SecurityContextHolder.clearContext();
        }

        filterChain.doFilter(request, response);
    }

    private String normalizeRole(Object claim) {
        String role = claim == null ? "STUDENT" : String.valueOf(claim).trim().toUpperCase();
        if (role.startsWith("ROLE_")) {
            role = role.substring("ROLE_".length());
        }
        return role.isBlank() ? "STUDENT" : role;
    }
}
