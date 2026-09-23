package com.ragapi.repository;

import com.ragapi.entity.CourseMaterialIndexJob;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.Optional;

public interface CourseMaterialIndexJobRepository extends MongoRepository<CourseMaterialIndexJob, String> {
    Optional<CourseMaterialIndexJob> findByIdempotencyKey(String idempotencyKey);
}
