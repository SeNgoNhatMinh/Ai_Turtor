package com.ragapi.repository;

import com.ragapi.entity.AuthRefreshToken;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.time.Instant;

@Repository
public interface AuthRefreshTokenRepository extends MongoRepository<AuthRefreshToken, String> {

    long deleteAllByExpiresAtBefore(Instant cutoff);

    long deleteAllByUserId(String userId);
}
