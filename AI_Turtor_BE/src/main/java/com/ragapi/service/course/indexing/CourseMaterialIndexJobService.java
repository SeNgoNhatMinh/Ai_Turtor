package com.ragapi.service.course.indexing;

import com.ragapi.entity.CourseMaterial;
import com.ragapi.entity.CourseMaterialIndexJob;
import com.ragapi.repository.CourseMaterialIndexJobRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.FindAndModifyOptions;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class CourseMaterialIndexJobService {

    private final CourseMaterialIndexJobRepository repository;
    private final MongoTemplate mongoTemplate;
    private final CourseMaterialIndexJobRecoveryService recoveryService;
    private final CourseMaterialIndexJobMetrics metrics;

    @Value("${rag.indexing.worker.max-retries:3}")
    private int configuredMaxRetries;

    public CourseMaterialIndexJob enqueue(CourseMaterial material) {
        Objects.requireNonNull(material, "material is required");
        if (material.getId() == null || material.getId().isBlank()) {
            throw new IllegalArgumentException("materialId is required before enqueueing");
        }

        String contentHash = normalizeHash(material);
        long materialVersion = resolveMaterialVersion(material);
        String idempotencyKey = material.getId() + ":" + materialVersion + ":" + contentHash;

        Optional<CourseMaterialIndexJob> existing = repository.findByIdempotencyKey(idempotencyKey);
        if (existing.isPresent()) {
            return existing.get();
        }

        LocalDateTime now = LocalDateTime.now();
        CourseMaterialIndexJob job = CourseMaterialIndexJob.builder()
                .idempotencyKey(idempotencyKey)
                .materialId(material.getId())
                .courseId(material.getCourseId())
                .contentHash(contentHash)
                .materialVersion(materialVersion)
                .status(CourseMaterialIndexJob.PENDING)
                .retryCount(0)
                .maxRetries(Math.max(1, configuredMaxRetries))
                .nextAttemptAt(now)
                .createdAt(now)
                .updatedAt(now)
                .build();
        try {
            CourseMaterialIndexJob saved = repository.save(job);
            metrics.enqueued();
            return saved;
        } catch (DuplicateKeyException duplicate) {
            return repository.findByIdempotencyKey(idempotencyKey).orElseThrow(() -> duplicate);
        }
    }

    public Optional<CourseMaterialIndexJob> claimNext() {
        return claimNext("worker-" + UUID.randomUUID());
    }

    public Optional<CourseMaterialIndexJob> claimNext(String workerId) {
        LocalDateTime now = LocalDateTime.now();
        recoveryService.recoverStaleJobs(now);

        Criteria ready = new Criteria().andOperator(
                Criteria.where("status").in(List.of(
                        CourseMaterialIndexJob.PENDING,
                        CourseMaterialIndexJob.RETRY
                )),
                new Criteria().orOperator(
                        Criteria.where("nextAttemptAt").is(null),
                        Criteria.where("nextAttemptAt").lte(now)
                )
        );
        Query query = new Query(ready)
                .with(Sort.by(Sort.Direction.ASC, "createdAt"))
                .limit(1);
        Update claim = new Update()
                .set("status", CourseMaterialIndexJob.PROCESSING)
                .set("lockedAt", now)
                .set("heartbeatAt", now)
                .set("workerId", workerId)
                .set("updatedAt", now)
                .unset("lastError");
        CourseMaterialIndexJob job = mongoTemplate.findAndModify(
                query,
                claim,
                FindAndModifyOptions.options().returnNew(true),
                CourseMaterialIndexJob.class
        );
        return Optional.ofNullable(job);
    }

    public void markCompleted(String jobId) {
        LocalDateTime now = LocalDateTime.now();
        mongoTemplate.updateFirst(
                Query.query(Criteria.where("_id").is(jobId)),
                new Update()
                        .set("status", CourseMaterialIndexJob.COMPLETED)
                        .set("completedAt", now)
                        .set("updatedAt", now)
                        .unset("lockedAt")
                        .unset("heartbeatAt")
                        .unset("workerId")
                        .unset("nextAttemptAt")
                        .unset("lastError"),
                CourseMaterialIndexJob.class
        );
        metrics.completed();
    }

    public void heartbeat(String jobId, String workerId) {
        mongoTemplate.updateFirst(
                Query.query(new Criteria().andOperator(
                        Criteria.where("_id").is(jobId),
                        Criteria.where("status").is(CourseMaterialIndexJob.PROCESSING),
                        Criteria.where("workerId").is(workerId)
                )),
                new Update()
                        .set("heartbeatAt", LocalDateTime.now())
                        .set("updatedAt", LocalDateTime.now()),
                CourseMaterialIndexJob.class
        );
    }

    public void retryOrFail(CourseMaterialIndexJob job, Exception failure) {
        int nextRetryCount = Objects.requireNonNullElse(job.getRetryCount(), 0) + 1;
        int maxRetries = Math.max(1, Objects.requireNonNullElse(job.getMaxRetries(), configuredMaxRetries));
        boolean exhausted = nextRetryCount >= maxRetries;
        LocalDateTime now = LocalDateTime.now();

        Update update = new Update()
                .set("status", exhausted ? CourseMaterialIndexJob.FAILED : CourseMaterialIndexJob.RETRY)
                .set("retryCount", nextRetryCount)
                .set("lastError", safeError(failure))
                .set("updatedAt", now)
                .unset("lockedAt")
                .unset("heartbeatAt")
                .unset("workerId");

        if (exhausted) {
            update.set("failedAt", now);
            update.unset("nextAttemptAt");
            metrics.failed();
        } else {
            long backoffSeconds = Math.min(300L, 5L * (1L << Math.min(6, nextRetryCount - 1)));
            update.set("nextAttemptAt", now.plusSeconds(backoffSeconds));
            update.unset("failedAt");
            metrics.retried();
        }

        mongoTemplate.updateFirst(
                Query.query(Criteria.where("_id").is(job.getId())),
                update,
                CourseMaterialIndexJob.class
        );
    }

    public boolean retryFailed(String jobId) {
        LocalDateTime now = LocalDateTime.now();
        var result = mongoTemplate.updateFirst(
                Query.query(new Criteria().andOperator(
                        Criteria.where("_id").is(jobId),
                        Criteria.where("status").is(CourseMaterialIndexJob.FAILED)
                )),
                new Update()
                        .set("status", CourseMaterialIndexJob.RETRY)
                        .set("retryCount", 0)
                        .set("nextAttemptAt", now)
                        .set("updatedAt", now)
                        .unset("failedAt")
                        .unset("lastError"),
                CourseMaterialIndexJob.class
        );
        return result.getModifiedCount() > 0;
    }

    public long deleteCompletedBefore(LocalDateTime cutoff) {
        return mongoTemplate.remove(
                Query.query(new Criteria().andOperator(
                        Criteria.where("status").is(CourseMaterialIndexJob.COMPLETED),
                        Criteria.where("completedAt").lt(cutoff)
                )),
                CourseMaterialIndexJob.class
        ).getDeletedCount();
    }

    private long resolveMaterialVersion(CourseMaterial material) {
        if (material.getIndexedAt() != null) {
            return Math.max(1L, material.getIndexedAt()
                    .atZone(java.time.ZoneId.systemDefault())
                    .toInstant()
                    .toEpochMilli());
        }
        return 1L;
    }

    private String normalizeHash(CourseMaterial material) {
        String hash = material.getContentHash();
        if (hash != null && !hash.isBlank()) {
            return hash.trim().toLowerCase();
        }
        return "material-" + material.getId();
    }

    private String safeError(Exception failure) {
        String message = failure == null ? null : failure.getMessage();
        if (message == null || message.isBlank()) {
            return failure == null ? "Indexing failed" : failure.getClass().getSimpleName();
        }
        return message.length() <= 1000 ? message : message.substring(0, 1000);
    }
}
