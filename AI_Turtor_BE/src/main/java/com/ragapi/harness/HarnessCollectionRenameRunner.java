package com.ragapi.harness;

import com.mongodb.MongoNamespace;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.stereotype.Component;

/** Moves teaching-path data off the old management collection names. */
@Slf4j
@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
@RequiredArgsConstructor
public class HarnessCollectionRenameRunner implements ApplicationRunner {

    private final MongoTemplate mongoTemplate;

    @Override
    public void run(ApplicationArguments args) {
        String database = mongoTemplate.getDb().getName();
        HarnessCollections.RENAMES_FROM_MANAGEMENT_NAMES.forEach((oldName, newName) ->
                renameIfNeeded(database, oldName, newName));
    }

    private void renameIfNeeded(String database, String oldName, String newName) {
        boolean oldExists = mongoTemplate.collectionExists(oldName);
        boolean newExists = mongoTemplate.collectionExists(newName);
        long newCount = newExists ? mongoTemplate.getCollection(newName).countDocuments() : 0;
        if (!HarnessCollections.shouldRename(oldExists, newExists, newCount)) {
            if (oldExists && newExists && newCount > 0) {
                log.warn("Left {} in place because {} already has documents", oldName, newName);
            }
            return;
        }
        if (newExists) {
            mongoTemplate.dropCollection(newName);
        }
        mongoTemplate.getCollection(oldName).renameCollection(new MongoNamespace(database, newName));
        log.info("Renamed Mongo collection {} -> {}", oldName, newName);
    }
}
