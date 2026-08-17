package com.ragapi.repository;

import com.ragapi.entity.LlmProviderOverride;
import org.springframework.data.mongodb.repository.MongoRepository;

public interface LlmProviderOverrideRepository extends MongoRepository<LlmProviderOverride, String> {
}
