package com.ragapi.service.course.indexing;

import com.ragapi.entity.CourseMaterialIndexJob;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import jakarta.annotation.PreDestroy;

import java.util.UUID;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.ScheduledFuture;
import java.util.concurrent.TimeUnit;

@Slf4j
@Component
@RequiredArgsConstructor
public class CourseMaterialIndexJobWorker {

    private final CourseMaterialIndexJobService jobService;
    private final CourseMaterialIndexingService indexingService;
    private final String workerId = UUID.randomUUID().toString();
    private final ScheduledExecutorService heartbeatScheduler = Executors.newSingleThreadScheduledExecutor(task -> {
        Thread thread = new Thread(task, "course-index-heartbeat");
        thread.setDaemon(true);
        return thread;
    });

    @Value("${rag.indexing.worker.enabled:true}")
    private boolean enabled;

    @Value("${rag.indexing.worker.batch-size:4}")
    private int batchSize;

    @Value("${rag.indexing.worker.completed-retention-days:14}")
    private int completedRetentionDays;

    @Value("${rag.indexing.worker.heartbeat-interval-seconds:30}")
    private long heartbeatIntervalSeconds;

    @Scheduled(fixedDelayString = "${rag.indexing.worker.poll-delay-ms:1000}")
    public void processNextJob() {
        if (!enabled) {
            return;
        }
        for (int processed = 0; processed < Math.max(1, batchSize); processed++) {
            var claimed = jobService.claimNext(workerId);
            if (claimed.isEmpty()) {
                break;
            }
            process(claimed.get());
        }
    }

    @Scheduled(cron = "${rag.indexing.worker.cleanup-cron:0 15 3 * * *}")
    public void cleanupCompletedJobs() {
        if (enabled) {
            jobService.deleteCompletedBefore(
                    java.time.LocalDateTime.now().minusDays(Math.max(1, completedRetentionDays)));
        }
    }

    private void process(CourseMaterialIndexJob job) {
        ScheduledFuture<?> heartbeat = null;
        try {
            jobService.heartbeat(job.getId(), workerId);
            heartbeat = heartbeatScheduler.scheduleAtFixedRate(
                    () -> refreshHeartbeat(job),
                    Math.max(5, heartbeatIntervalSeconds),
                    Math.max(5, heartbeatIntervalSeconds),
                    TimeUnit.SECONDS
            );
            indexingService.processQueuedIndex(job.getMaterialId());
            jobService.markCompleted(job.getId());
        } catch (Exception failure) {
            log.error(
                    "Course material indexing job failed (jobId={}, materialId={}, attempt={})",
                    job.getId(),
                    job.getMaterialId(),
                    job.getRetryCount(),
                    failure
            );
            jobService.retryOrFail(job, failure);
        } finally {
            if (heartbeat != null) {
                heartbeat.cancel(false);
            }
        }
    }

    private void refreshHeartbeat(CourseMaterialIndexJob job) {
        try {
            jobService.heartbeat(job.getId(), workerId);
        } catch (Exception failure) {
            log.warn("Could not refresh indexing lease for jobId={}: {}", job.getId(), failure.getMessage());
        }
    }

    @PreDestroy
    void shutdownHeartbeatScheduler() {
        heartbeatScheduler.shutdownNow();
    }
}
