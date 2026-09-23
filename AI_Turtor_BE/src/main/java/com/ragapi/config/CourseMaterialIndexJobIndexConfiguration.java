package com.ragapi.config;

import com.ragapi.entity.CourseMaterialIndexJob;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.index.Index;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class CourseMaterialIndexJobIndexConfiguration {

    private final MongoTemplate mongoTemplate;

    @PostConstruct
    void ensureIndexes() {
        var indexOps = mongoTemplate.indexOps(CourseMaterialIndexJob.class);
        indexOps.ensureIndex(new Index()
                .on("idempotencyKey", Sort.Direction.ASC)
                .unique()
                .named("material_index_job_idempotency_uq"));
        indexOps.ensureIndex(new Index()
                .on("status", Sort.Direction.ASC)
                .on("nextAttemptAt", Sort.Direction.ASC)
                .on("createdAt", Sort.Direction.ASC)
                .named("material_index_job_queue_idx"));
    }
}
