package com.ragapi.config;

import com.ragapi.entity.ExpertTask;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.index.Index;
import org.springframework.stereotype.Component;

@Slf4j
@Component
@RequiredArgsConstructor
public class ExpertTaskIndexConfiguration {
    private final MongoTemplate mongoTemplate;

    @PostConstruct
    void ensureIndexes() {
        try {
            var indexOps = mongoTemplate.indexOps(ExpertTask.class);
            indexOps.ensureIndex(new Index()
                    .on("courseId", Sort.Direction.ASC)
                    .on("type", Sort.Direction.ASC)
                    .on("updatedAt", Sort.Direction.DESC)
                    .named("expert_task_course_type_updated"));
            indexOps.ensureIndex(new Index()
                    .on("courseId", Sort.Direction.ASC)
                    .on("status", Sort.Direction.ASC)
                    .on("updatedAt", Sort.Direction.DESC)
                    .named("expert_task_course_status_updated"));
            indexOps.ensureIndex(new Index()
                    .on("assigneeId", Sort.Direction.ASC)
                    .on("status", Sort.Direction.ASC)
                    .on("updatedAt", Sort.Direction.DESC)
                    .named("expert_task_assignee_status_updated"));
        } catch (Exception error) {
            log.warn("Cannot ensure expert task indexes: {}", error.getMessage());
        }
    }
}
