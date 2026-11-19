package com.ragapi.harness.handoff;

import com.ragapi.harness.entity.QuestionEscalation;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.index.Index;
import org.springframework.stereotype.Component;

/** Ensures cross-process idempotency for support-ticket creation. */
@Component
@RequiredArgsConstructor
public class EscalationIndexConfiguration implements ApplicationRunner {

    private final MongoTemplate mongoTemplate;

    @Override
    public void run(ApplicationArguments args) {
        mongoTemplate.indexOps(QuestionEscalation.class).ensureIndex(
                new Index()
                        .on("idempotencyKey", Sort.Direction.ASC)
                        .unique()
                        .sparse()
        );
    }
}
