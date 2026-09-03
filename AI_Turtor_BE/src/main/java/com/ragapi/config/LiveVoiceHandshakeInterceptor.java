package com.ragapi.config;

import com.ragapi.dto.LiveLessonResponse;
import com.ragapi.entity.CourseEnrollment;
import com.ragapi.entity.User;
import com.ragapi.repository.CourseEnrollmentRepository;
import com.ragapi.repository.UserRepository;
import com.ragapi.service.JwtService;
import com.ragapi.service.LiveLessonService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.server.ServerHttpRequest;
import org.springframework.http.server.ServerHttpResponse;
import org.springframework.stereotype.Component;
import org.springframework.util.MultiValueMap;
import org.springframework.web.socket.WebSocketHandler;
import org.springframework.web.socket.server.HandshakeInterceptor;
import org.springframework.web.util.UriComponentsBuilder;

import java.util.Map;
import java.util.regex.Pattern;

@Component
@RequiredArgsConstructor
public class LiveVoiceHandshakeInterceptor implements HandshakeInterceptor {

    private static final Pattern OPAQUE_ID = Pattern.compile(
            "(?i)^(?:[a-f\\d]{24}|[a-f\\d]{8}-[a-f\\d]{4}-[1-5][a-f\\d]{3}-[89ab][a-f\\d]{3}-[a-f\\d]{12})$"
    );

    private final JwtService jwtService;
    private final LiveLessonService liveLessonService;
    private final UserRepository userRepository;
    private final CourseEnrollmentRepository enrollmentRepository;

    @Override
    public boolean beforeHandshake(ServerHttpRequest request, ServerHttpResponse response,
                                   WebSocketHandler wsHandler, Map<String, Object> attributes) {
        MultiValueMap<String, String> query = UriComponentsBuilder.fromUri(request.getURI()).build().getQueryParams();
        String token = query.getFirst("token");
        String lessonId = query.getFirst("lessonId");
        Map<String, Object> claims = jwtService.validateAndParse(token);
        String userId = text(claims.get("userId"));
        String role = text(claims.get("role")).toUpperCase();
        if (role.isBlank()) {
            role = "STUDENT";
        }
        LiveLessonResponse lesson = liveLessonService.get(lessonId, userId, role);
        attributes.put("userId", userId);
        attributes.put("role", role);
        attributes.put("lessonId", lessonId);
        attributes.put("displayName", resolveDisplayName(query.getFirst("displayName"), claims, userId, lesson));
        return true;
    }

    @Override
    public void afterHandshake(ServerHttpRequest request, ServerHttpResponse response,
                               WebSocketHandler wsHandler, Exception exception) {
        // No-op.
    }

    private String resolveDisplayName(String queryName, Map<String, Object> claims, String userId,
                                      LiveLessonResponse lesson) {
        if (isHumanName(queryName)) {
            return queryName.trim();
        }
        if (isHumanName(text(claims.get("fullName")))) {
            return text(claims.get("fullName"));
        }
        User user = userId.isBlank() ? null : userRepository.findById(userId).orElse(null);
        if (user != null && isHumanName(user.getFullName())) {
            return user.getFullName().trim();
        }
        if (lesson != null && !userId.isBlank()) {
            String enrolledName = enrollmentRepository
                    .findByStudentIdAndCourseIdAndClassId(userId, lesson.getCourseId(), lesson.getClassId())
                    .map(CourseEnrollment::getStudentName)
                    .orElse("");
            if (isHumanName(enrolledName)) {
                return enrolledName.trim();
            }
        }
        if (user != null && isHumanName(user.getEmail())) {
            return user.getEmail().trim();
        }
        if (isHumanName(text(claims.get("email")))) {
            return text(claims.get("email"));
        }
        return userId;
    }

    private static boolean isHumanName(String value) {
        String text = text(value);
        return !text.isEmpty() && !OPAQUE_ID.matcher(text).matches();
    }

    private static String text(Object value) {
        if (value == null) {
            return "";
        }
        String text = String.valueOf(value).trim();
        return text.isEmpty() || "null".equalsIgnoreCase(text) ? "" : text;
    }
}
