package com.ragapi.repository;

import com.ragapi.entity.StudentLlmUsage;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;

public interface StudentLlmUsageRepository extends MongoRepository<StudentLlmUsage, String> {
    List<StudentLlmUsage> findByUserIdOrderByCreatedAtDesc(String userId, Pageable pageable);
}
