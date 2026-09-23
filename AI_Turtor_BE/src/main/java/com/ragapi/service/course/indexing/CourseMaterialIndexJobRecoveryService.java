package com.ragapi.service.course.indexing;

import com.ragapi.entity.CourseMaterialIndexJob;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;

/** Returns abandoned processing leases to the retry queue. */
@Slf4j
@Service
@RequiredArgsConstructor
public class CourseMaterialIndexJobRecoveryService {

    private final MongoTemplate mongoTemplate;
    private final CourseMaterialIndexJobMetrics metrics;

    @Value("${rag.indexing.worker.lock-timeout-seconds:900}")
    private long lockTimeoutSeconds;

    public long recoverStaleJobs(LocalDateTime now) {
        LocalDateTime staleBefore = now.minusSeconds(Math.max(30, lockTimeoutSeconds));
        Query stale = Query.query(new Criteria().andOperator(
                Criteria.where("status").is(CourseMaterialIndexJob.PROCESSING),
                new Criteria().orOperator(
                        Criteria.where("heartbeatAt").lte(staleBefore),
                        new Criteria().andOperator(
                                Criteria.where("heartbeatAt").is(null),
                                Criteria.where("lockedAt").lte(staleBefore)
                        )
                )
        ));
        Update recover = new Update()
                .set("status", CourseMaterialIndexJob.RETRY)
                .set("nextAttemptAt", now)
                .set("updatedAt", now)
                .set("lastError", "Recovered after worker lease timeout")
                .unset("lockedAt")
                .unset("heartbeatAt")
                .unset("workerId");
        long recovered = mongoTemplate.updateMulti(stale, recover, CourseMaterialIndexJob.class)
                .getModifiedCount();
        if (recovered > 0) {
            metrics.recovered(recovered);
            log.warn("Recovered {} stale course material indexing jobs", recovered);
        }
        return recovered;
    }
}
