package com.ragapi.repository;

import com.ragapi.entity.CaseMemory;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;
import java.util.Optional;

public interface CaseMemoryRepository extends MongoRepository<CaseMemory, String> {
    Optional<CaseMemory> findByUserIdAndCaseId(String userId, String caseId);
    List<CaseMemory> findByUserId(String userId);
}






