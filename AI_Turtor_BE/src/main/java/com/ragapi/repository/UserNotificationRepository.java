package com.ragapi.repository;

import com.ragapi.entity.UserNotification;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;

public interface UserNotificationRepository extends MongoRepository<UserNotification, String> {
    List<UserNotification> findTop30ByUserIdOrderByCreatedAtDesc(String userId);

    List<UserNotification> findByUserIdAndReadAtIsNull(String userId);

    long countByUserIdAndReadAtIsNull(String userId);
}
