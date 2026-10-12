package com.ragapi.repository;

import com.ragapi.entity.StudentLlmCredential;
import org.springframework.data.mongodb.repository.MongoRepository;

public interface StudentLlmCredentialRepository extends MongoRepository<StudentLlmCredential, String> {
}
