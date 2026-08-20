package com.ragapi.config;

import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.annotation.Order;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.core.userdetails.User;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.provisioning.InMemoryUserDetailsManager;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.AuthenticationEntryPoint;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;
import jakarta.servlet.http.HttpServletResponse;

import java.util.Arrays;
import java.util.List;

@Configuration
@RequiredArgsConstructor
public class SecurityConfig {

    private static final String DEFAULT_ALLOWED_ORIGINS = "http://localhost:5173,http://127.0.0.1:5173,http://localhost:3000,http://127.0.0.1:3000";

    private final JwtAuthenticationFilter jwtAuthenticationFilter;

    @Value("${app.cors.allowed-origins:}")
    private String allowedOrigins;

    @Value("${security.swagger.username:swagger-admin}")
    private String swaggerUsername;

    @Value("${security.swagger.password:}")
    private String swaggerPassword;

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    public UserDetailsService swaggerUserDetailsService(PasswordEncoder passwordEncoder) {
        if (swaggerPassword == null || swaggerPassword.isBlank()) {
            throw new IllegalStateException("Swagger password must be configured");
        }
        return new InMemoryUserDetailsManager(
                User.withUsername(swaggerUsername)
                        .password(passwordEncoder.encode(swaggerPassword))
                        .roles("SWAGGER")
                        .build()
        );
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration configuration = new CorsConfiguration();
        configuration.setAllowedOriginPatterns(parseCsv(allowedOrigins));
        configuration.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
        configuration.setAllowedHeaders(List.of("*"));
        configuration.setExposedHeaders(List.of("Content-Disposition", "Authorization"));
        configuration.setAllowCredentials(true);
        configuration.setMaxAge(3600L);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", configuration);
        return source;
    }

    @Bean
    @Order(1)
    public SecurityFilterChain swaggerSecurityFilterChain(HttpSecurity http) throws Exception {
        AuthenticationEntryPoint swaggerEntryPoint = (request, response, exception) -> {
            response.setHeader("WWW-Authenticate", "Basic realm=\"AI Tutor Swagger\"");
            response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
        };
        http.securityMatcher("/swagger-ui/**", "/swagger-ui.html", "/v3/api-docs/**")
                .csrf(csrf -> csrf.disable())
                .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(auth -> auth.anyRequest().hasRole("SWAGGER"))
                .exceptionHandling(exceptions -> exceptions
                        .authenticationEntryPoint(swaggerEntryPoint)
                        .accessDeniedHandler((request, response, exception) ->
                                swaggerEntryPoint.commence(request, response, null)))
                .httpBasic(basic -> basic.authenticationEntryPoint(swaggerEntryPoint));
        return http.build();
    }

    @Bean
    @Order(2)
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http.csrf(csrf -> csrf.disable())
                .cors(cors -> cors.configurationSource(corsConfigurationSource()))
                .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers(HttpMethod.OPTIONS, "/**").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/material-downloads/*").permitAll()
                        .requestMatchers(
                                "/api/users/login",
                                "/api/users/register",
                                "/ws/chat/**",
                                "/ws/events/**",
                                "/actuator/health",
                                "/actuator/health/**"
                        ).permitAll()
                        // n8n trace logging should not block the harness if a user token expires.
                        .requestMatchers(HttpMethod.POST, "/api/harness/logs", "/api/harness/error-logs").permitAll()
                        .requestMatchers(HttpMethod.POST, "/api/v2/expert-training/coverage/analyze", "/api/v2/expert-training/eval-runs").hasAnyRole("SENIOR_MENTOR", "ADMIN")
                        .requestMatchers(HttpMethod.POST, "/api/v2/expert-training/chapters/confirm", "/api/v2/expert-training/chapters/manual", "/api/v2/expert-training/chapters/start", "/api/v2/expert-training/chapters/tasks", "/api/v2/expert-training/chapters/*/ignore", "/api/v2/expert-training/tasks").hasAnyRole("SENIOR_MENTOR", "ADMIN")
                        .requestMatchers(HttpMethod.PUT, "/api/v2/expert-training/tasks/*").hasAnyRole("SENIOR_MENTOR", "ADMIN")
                        .requestMatchers(HttpMethod.DELETE, "/api/v2/expert-training/tasks/*").hasAnyRole("SENIOR_MENTOR", "ADMIN")
                        .requestMatchers(HttpMethod.GET, "/api/v2/expert-training/chapters/**").hasAnyRole("TEACHER", "SENIOR_MENTOR", "ADMIN")
                        .requestMatchers(HttpMethod.POST, "/api/v2/expert-training/gold-qa/*/approve", "/api/v2/expert-training/gold-qa/*/reject", "/api/v2/expert-training/rubrics/*/approve", "/api/v2/expert-training/rubrics/*/reject").hasAnyRole("SENIOR_MENTOR", "ADMIN")
                        .requestMatchers("/api/v2/expert-training/**").hasAnyRole("TEACHER", "SENIOR_MENTOR", "ADMIN")
                        .requestMatchers(HttpMethod.POST, "/api/tutor/answer-reviews/*/senior-resolve").hasAnyRole("SENIOR_MENTOR", "ADMIN")
                        .requestMatchers("/api/tutor/answer-cache/**").hasAnyRole("SENIOR_MENTOR", "ADMIN")
                        .requestMatchers("/api/admin/**", "/api/academic/**").hasRole("ADMIN")
                        .requestMatchers(HttpMethod.POST, "/api/mentors/import/**").hasRole("ADMIN")
                        .requestMatchers(HttpMethod.GET, "/api/mentors/import/**").hasAnyRole("ADMIN", "TEACHER", "SENIOR_MENTOR")
                        .requestMatchers("/api/mentor/**", "/api/teachers/**").hasAnyRole("TEACHER", "SENIOR_MENTOR", "ADMIN")
                        .requestMatchers("/api/tutor/teachers/**").hasAnyRole("TEACHER", "SENIOR_MENTOR", "ADMIN")
                        .requestMatchers("/api/tutor/knowledge-candidates/**", "/api/tutor/escalations/knowledge-candidates/**").hasAnyRole("TEACHER", "SENIOR_MENTOR", "ADMIN")
                        .requestMatchers(HttpMethod.POST, "/api/tutor/escalations/*/answer").hasAnyRole("TEACHER", "SENIOR_MENTOR", "ADMIN")
                        .requestMatchers(HttpMethod.POST, "/api/tutor/escalations/*/knowledge-candidate").hasAnyRole("TEACHER", "SENIOR_MENTOR", "ADMIN")
                        .requestMatchers(HttpMethod.POST, "/api/tutor/knowledge-images").hasAnyRole("TEACHER", "SENIOR_MENTOR", "ADMIN")
                        .requestMatchers(HttpMethod.GET, "/api/tutor/knowledge-images/**").authenticated()
                        .requestMatchers(HttpMethod.GET, "/api/harness/**").hasRole("ADMIN")
                        .requestMatchers("/api/health/**").hasRole("ADMIN")
                        .requestMatchers(HttpMethod.POST, "/api/courses/*/materials/upload", "/api/courses/*/materials/import-url").hasAnyRole("TEACHER", "SENIOR_MENTOR", "ADMIN")
                        .requestMatchers(HttpMethod.POST, "/api/courses/*/materials/reindex", "/api/courses/*/materials/*/reindex").hasAnyRole("SENIOR_MENTOR", "ADMIN")
                        .requestMatchers(HttpMethod.PUT, "/api/courses/*/materials/**").hasAnyRole("TEACHER", "SENIOR_MENTOR", "ADMIN")
                        .requestMatchers(HttpMethod.DELETE, "/api/courses/*/materials/**").hasAnyRole("TEACHER", "SENIOR_MENTOR", "ADMIN")
                        .requestMatchers(HttpMethod.POST, "/api/tutor/quiz-assignments/**").hasAnyRole("TEACHER", "SENIOR_MENTOR", "ADMIN")
                        .requestMatchers(HttpMethod.PUT, "/api/tutor/quiz-assignments/**", "/api/tutor/quizzes/*/teacher-review").hasAnyRole("TEACHER", "SENIOR_MENTOR", "ADMIN")
                        .requestMatchers(HttpMethod.DELETE, "/api/tutor/quiz-assignments/**").hasAnyRole("TEACHER", "SENIOR_MENTOR", "ADMIN")
                        .requestMatchers("/api/chat/**").hasAnyRole("STUDENT", "TEACHER", "SENIOR_MENTOR", "ADMIN")
                        .requestMatchers("/api/code-mentor/**", "/api/ai/**", "/api/tutor/**", "/api/students/**", "/api/courses/**", "/api/improve/**", "/api/improve-plans/**").authenticated()
                        .anyRequest().authenticated()
                )
                .addFilterBefore(jwtAuthenticationFilter, UsernamePasswordAuthenticationFilter.class)
                .exceptionHandling(exceptions -> exceptions
                        .authenticationEntryPoint((request, response, authException) -> {
                            response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
                            response.setContentType("application/json;charset=UTF-8");
                            response.getWriter().write("{\"error\":\"Unauthorized\"}");
                        })
                        .accessDeniedHandler((request, response, accessDeniedException) -> {
                            var authentication = org.springframework.security.core.context.SecurityContextHolder
                                    .getContext()
                                    .getAuthentication();
                            if (authentication == null || !authentication.isAuthenticated()) {
                                response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
                                response.setContentType("application/json;charset=UTF-8");
                                response.getWriter().write("{\"error\":\"Unauthorized\"}");
                                return;
                            }
                            response.setStatus(HttpServletResponse.SC_FORBIDDEN);
                            response.setContentType("application/json;charset=UTF-8");
                            response.getWriter().write("{\"error\":\"Forbidden\"}");
                        }));
        return http.build();
    }

    private List<String> parseCsv(String value) {
        String source = value == null || value.isBlank() ? DEFAULT_ALLOWED_ORIGINS : value;
        return Arrays.stream(source.split(","))
                .map(String::trim)
                .filter(origin -> !origin.isBlank())
                .toList();
    }
}
