package com.ragapi.service;

import com.ragapi.dto.CourseRagAnswer;
import com.ragapi.dto.TutorCacheHitMetadata;
import com.ragapi.entity.TutorCacheHitAudit;
import com.ragapi.repository.TutorCacheHitAuditRepository;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.index.Index;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.List;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.TimeUnit;

@Slf4j
@Service
@RequiredArgsConstructor
public class TutorCacheHitAuditService {
    private static final int RETENTION_DAYS = 30;

    private final TutorCacheHitAuditRepository repository;
    private final MongoTemplate mongoTemplate;

    @PostConstruct
    void ensureTtlIndex() {
        try {
            mongoTemplate.indexOps(TutorCacheHitAudit.class)
                    .ensureIndex(new Index().on("expiresAt", org.springframework.data.domain.Sort.Direction.ASC)
                            .expire(0, TimeUnit.SECONDS));
        } catch (Exception error) {
            log.warn("Cannot ensure tutor cache audit TTL index: {}", error.getMessage());
        }
    }

    public CourseRagAnswer completeHit(CourseRagAnswer answer, long backendStartedNanos) {
        if (answer == null || answer.getCacheHitMetadata() == null) {
            return answer;
        }
        TutorCacheHitMetadata metadata = answer.getCacheHitMetadata();
        long backendProcessingMs = elapsedMillis(backendStartedNanos);
        LocalDateTime now = LocalDateTime.now();
        TutorCacheHitAudit audit = TutorCacheHitAudit.builder()
                    .matchedCacheId(metadata.getMatchedCacheId())
                    .courseId(metadata.getCourseId())
                    .classId(metadata.getClassId())
                    .hitType(metadata.getHitType())
                    .similarity(metadata.getSimilarity())
                    .cacheLookupMs(metadata.getCacheLookupMs() == null ? 0L : metadata.getCacheLookupMs())
                    .backendProcessingMs(backendProcessingMs)
                    .createdAt(now)
                    .expiresAt(now.plusDays(RETENTION_DAYS))
                    .build();
        CompletableFuture.runAsync(() -> {
            try {
                repository.save(audit);
            } catch (Exception error) {
                log.warn("Cannot persist tutor cache hit audit for cacheId={}: {}",
                        metadata.getMatchedCacheId(), error.getMessage());
            }
        });
        return answer;
    }

    public List<TutorCacheHitAudit> recentHits(String courseId, int limit) {
        return repository.findByCourseIdOrderByCreatedAtDesc(
                courseId.trim(),
                PageRequest.of(0, Math.max(1, Math.min(limit, 200)))
        );
    }

    public List<TutorCacheHitAudit> hitsSince(String courseId, LocalDateTime since) {
        return repository.findByCourseIdAndCreatedAtAfterOrderByCreatedAtDesc(courseId.trim(), since);
    }

    static long elapsedMillis(long startedNanos) {
        return Math.max(0L, Duration.ofNanos(System.nanoTime() - startedNanos).toMillis());
    }
}
