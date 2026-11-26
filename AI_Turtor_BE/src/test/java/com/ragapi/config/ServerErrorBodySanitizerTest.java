package com.ragapi.config;

import org.junit.jupiter.api.Test;
import org.springframework.http.server.ServletServerHttpRequest;
import org.springframework.http.server.ServletServerHttpResponse;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class ServerErrorBodySanitizerTest {

    private final ServerErrorBodySanitizer sanitizer = new ServerErrorBodySanitizer();

    private Object write(int status, Object body) {
        MockHttpServletResponse servletResponse = new MockHttpServletResponse();
        servletResponse.setStatus(status);
        return sanitizer.beforeBodyWrite(body, null, null, null,
                new ServletServerHttpRequest(new MockHttpServletRequest("GET", "/api/x")),
                new ServletServerHttpResponse(servletResponse));
    }

    @Test
    void hidesInternalDetailOn500() {
        Object body = write(500, Map.of("error", "Server error: com.mongodb.MongoTimeoutException at host-1"));
        assertThat(body).isEqualTo(Map.of("error", ServerErrorBodySanitizer.GENERIC_MESSAGE));
    }

    @Test
    void keepsClientAndServiceUnavailableMessages() {
        Map<String, String> badRequest = Map.of("error", "studentId is required");
        Map<String, String> unavailable = Map.of("error", "AI đang bận, vui lòng thử lại");
        assertThat(write(400, badRequest)).isSameAs(badRequest);
        assertThat(write(503, unavailable)).isSameAs(unavailable);
    }
}
