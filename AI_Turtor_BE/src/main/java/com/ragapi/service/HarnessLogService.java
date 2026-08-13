package com.ragapi.service;

import com.ragapi.dto.HarnessLogRequest;
import com.ragapi.entity.HarnessLog;
import com.ragapi.repository.HarnessLogRepository;
import lombok.AllArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.Comparator;
import java.util.List;
import java.util.UUID;

@Service
@AllArgsConstructor
public class HarnessLogService {

    private static final String EVENT_INFO = "INFO";
    private static final String EVENT_ERROR = "ERROR";
    private static final String STATUS_SUCCESS = "SUCCESS";
    private static final String STATUS_FAILED = "FAILED";

    private final HarnessLogRepository harnessLogRepository;

    public HarnessLog createLog(HarnessLogRequest request) {
        if (request == null) {
            throw new IllegalArgumentException("request body is required");
        }

        LocalDateTime now = LocalDateTime.now();
        HarnessLog log = HarnessLog.builder()
                .id(UUID.randomUUID().toString())
                .traceId(resolveTraceId(request.getTraceId()))
                .sessionId(trimToNull(request.getSessionId()))
                .conversationId(trimToNull(request.getConversationId()))
                .studentId(trimToNull(request.getStudentId()))
                .courseId(trimToNull(request.getCourseId()))
                .classId(trimToNull(request.getClassId()))
                .workflowName(trimToNull(request.getWorkflowName()))
                .nodeName(trimToNull(request.getNodeName()))
                .mode(normalizeUpper(request.getMode()))
                .eventType(defaultUpper(request.getEventType(), EVENT_INFO))
                .status(defaultUpper(request.getStatus(), STATUS_SUCCESS))
                .errorType(normalizeUpper(request.getErrorType()))
                .errorMessage(trimToNull(request.getErrorMessage()))
                .errorStack(trimToNull(request.getErrorStack()))
                .requestPayload(request.getRequestPayload())
                .responsePayload(request.getResponsePayload())
                .metadata(request.getMetadata())
                .createdAt(now)
                .build();

        return harnessLogRepository.save(log);
    }

    public HarnessLog createErrorLog(HarnessLogRequest request) {
        if (request == null) {
            throw new IllegalArgumentException("request body is required");
        }
        request.setEventType(EVENT_ERROR);
        request.setStatus(STATUS_FAILED);
        return createLog(request);
    }

    public List<HarnessLog> listLogs(
            String traceId,
            String studentId,
            String conversationId,
            String courseId,
            String status,
            String eventType
    ) {
        return harnessLogRepository.findAll().stream()
                .filter(log -> matches(log.getTraceId(), traceId))
                .filter(log -> matches(log.getStudentId(), studentId))
                .filter(log -> matches(log.getConversationId(), conversationId))
                .filter(log -> matches(log.getCourseId(), courseId))
                .filter(log -> matches(log.getStatus(), normalizeUpper(status)))
                .filter(log -> matches(log.getEventType(), normalizeUpper(eventType)))
                .sorted(Comparator.comparing(HarnessLog::getCreatedAt).reversed())
                .toList();
    }

    public List<HarnessLog> getTrace(String traceId) {
        if (traceId == null || traceId.isBlank()) {
            throw new IllegalArgumentException("traceId is required");
        }
        return harnessLogRepository.findByTraceIdOrderByCreatedAtAsc(traceId.trim());
    }

    public List<HarnessLog> listErrorLogs(String traceId, String studentId, String courseId) {
        return listLogs(traceId, studentId, null, courseId, STATUS_FAILED, EVENT_ERROR);
    }

    private String resolveTraceId(String traceId) {
        String normalized = trimToNull(traceId);
        return normalized == null ? UUID.randomUUID().toString() : normalized;
    }

    private boolean matches(String actual, String expected) {
        if (expected == null || expected.isBlank()) {
            return true;
        }
        return expected.equals(actual);
    }

    private String defaultUpper(String value, String defaultValue) {
        String normalized = normalizeUpper(value);
        return normalized == null ? defaultValue : normalized;
    }

    private String normalizeUpper(String value) {
        String normalized = trimToNull(value);
        return normalized == null ? null : normalized.toUpperCase();
    }

    private String trimToNull(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }
}
