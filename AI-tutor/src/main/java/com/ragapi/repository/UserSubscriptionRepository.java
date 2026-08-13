package com.ragapi.repository;

import com.ragapi.entity.UserSubscription;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface UserSubscriptionRepository extends MongoRepository<UserSubscription, String> {
    List<UserSubscription> findByUserId(String userId);

    List<UserSubscription> findByStatus(String status);

    List<UserSubscription> findByUserIdAndStatus(String userId, String status);

    List<UserSubscription> findByUserIdAndPlanIdAndStatus(String userId, String planId, String status);

    List<UserSubscription> findByUserIdAndPlanCodeAndStatus(String userId, String planCode, String status);
}
