package com.ragapi.repository;

import com.ragapi.entity.UserMemory;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.Optional;

public interface UserMemoryRepository extends MongoRepository<UserMemory, String> {
    Optional<UserMemory> findByUserId(String userId);
}
