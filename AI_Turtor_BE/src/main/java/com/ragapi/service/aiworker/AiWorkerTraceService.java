package com.ragapi.service.aiworker;

import com.ragapi.entity.AiWorkerTraceEvent;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.slf4j.MDC;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class AiWorkerTraceService {
    private final MongoTemplate mongoTemplate;

    public String currentTraceId() {
        String traceId = MDC.get("aiTraceId");
        return traceId == null || traceId.isBlank() ? null : traceId;
    }

    public String newTraceId() {
        return UUID.randomUUID().toString();
    }

    public void record(String traceId, String workerId, String workerName, String stage,
                       String status, String model, Long durationMs, String detail) {
        if (traceId == null || traceId.isBlank()) return;
        try {
            mongoTemplate.save(AiWorkerTraceEvent.builder()
                    .traceId(traceId)
                    .workerId(workerId)
                    .workerName(workerName)
                    .stage(stage)
                    .status(status)
                    .model(model)
                    .durationMs(durationMs)
                    .detail(safeDetail(detail))
                    .createdAt(LocalDateTime.now())
                    .build());
        } catch (Exception exception) {
            // Observability must never break the student-facing answer path.
            log.warn("Could not persist AI worker trace event (worker={}, type={})",
                    workerId, exception.getClass().getSimpleName());
        }
    }

    public List<AiWorkerTraceEvent> recent(int limit) {
        Query query = new Query().with(Sort.by(Sort.Direction.DESC, "createdAt"))
                .limit(Math.max(1, Math.min(limit, 500)));
        return mongoTemplate.find(query, AiWorkerTraceEvent.class);
    }

    private String safeDetail(String detail) {
        if (detail == null || detail.isBlank()) return null;
        // Never persist prompts, answers, API keys, or provider response bodies in worker trace detail.
        String normalized = detail.replaceAll("(?i)(api[_ -]?key|authorization|bearer)\\s*[:=]?\\s*\\S+", "$1=[REDACTED]");
        return normalized.length() > 500 ? normalized.substring(0, 500) : normalized;
    }
}