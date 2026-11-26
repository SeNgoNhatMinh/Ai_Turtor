package com.ragapi.config;

import lombok.extern.slf4j.Slf4j;
import org.springframework.core.MethodParameter;
import org.springframework.http.MediaType;
import org.springframework.http.converter.HttpMessageConverter;
import org.springframework.http.server.ServerHttpRequest;
import org.springframework.http.server.ServerHttpResponse;
import org.springframework.http.server.ServletServerHttpResponse;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.servlet.mvc.method.annotation.ResponseBodyAdvice;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Controllers answer failures with {@code Map.of("error", e.getMessage())}; for a
 * 500 that message is an internal exception text (driver, provider, stack detail).
 * Clients get a generic message instead; the original stays in the server log.
 * 4xx and 503 bodies are untouched: they carry messages meant for the user.
 */
@Slf4j
@RestControllerAdvice
public class ServerErrorBodySanitizer implements ResponseBodyAdvice<Object> {

    static final String GENERIC_MESSAGE = "Hệ thống đang gặp sự cố. Vui lòng thử lại sau.";
    private static final String[] MESSAGE_KEYS = {"error", "message", "details"};

    @Override
    public boolean supports(MethodParameter returnType, Class<? extends HttpMessageConverter<?>> converterType) {
        return true;
    }

    @Override
    public Object beforeBodyWrite(Object body, MethodParameter returnType, MediaType selectedContentType,
                                  Class<? extends HttpMessageConverter<?>> selectedConverterType,
                                  ServerHttpRequest request, ServerHttpResponse response) {
        if (!(response instanceof ServletServerHttpResponse servletResponse)
                || servletResponse.getServletResponse().getStatus() != 500
                || !(body instanceof Map<?, ?> map)) {
            return body;
        }
        Map<Object, Object> sanitized = new LinkedHashMap<>(map);
        for (String key : MESSAGE_KEYS) {
            Object value = sanitized.get(key);
            if (value instanceof String text && !text.equals(GENERIC_MESSAGE)) {
                log.warn("Hid 500 detail from {} {}: {}", request.getMethod(), request.getURI().getPath(), text);
                sanitized.put(key, GENERIC_MESSAGE);
            }
        }
        return sanitized;
    }
}
