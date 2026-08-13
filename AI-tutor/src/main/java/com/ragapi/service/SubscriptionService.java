package com.ragapi.service;

import com.ragapi.dto.AssignSubscriptionRequest;
import com.ragapi.dto.SubscriptionPlanRequest;
import com.ragapi.dto.SubscriptionStatusUpdateRequest;
import com.ragapi.entity.SubscriptionPlan;
import com.ragapi.entity.User;
import com.ragapi.entity.UserSubscription;
import com.ragapi.repository.SubscriptionPlanRepository;
import com.ragapi.repository.UserRepository;
import com.ragapi.repository.UserSubscriptionRepository;
import com.ragapi.util.SubscriptionDateCalculator;
import lombok.AllArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Service
@AllArgsConstructor
public class SubscriptionService {
    private final SubscriptionPlanRepository subscriptionPlanRepository;
    private final UserSubscriptionRepository userSubscriptionRepository;
    private final UserRepository userRepository;

    public List<SubscriptionPlan> getPlans(boolean includeInactive) {
        return includeInactive ? subscriptionPlanRepository.findAll() : subscriptionPlanRepository.findByIsActiveTrue();
    }

    public SubscriptionPlan createPlan(SubscriptionPlanRequest request) {
        if (request.getCode() == null || request.getCode().isBlank()) {
            throw new RuntimeException("Plan code is required");
        }
        if (subscriptionPlanRepository.existsByCode(request.getCode())) {
            throw new RuntimeException("Plan code already exists");
        }
        if (request.getDurationDays() == null || request.getDurationDays() <= 0) {
            throw new RuntimeException("Duration days must be positive");
        }

        LocalDateTime now = LocalDateTime.now();
        SubscriptionPlan plan = SubscriptionPlan.builder()
                .id(UUID.randomUUID().toString())
                .code(request.getCode())
                .name(request.getName())
                .description(request.getDescription())
                .durationDays(request.getDurationDays())
                .price(request.getPrice() == null ? 0.0 : request.getPrice())
                .currency(request.getCurrency() == null ? "VND" : request.getCurrency())
                .isActive(request.getIsActive() == null || request.getIsActive())
                .createdAt(now)
                .updatedAt(now)
                .build();

        return subscriptionPlanRepository.save(plan);
    }

    public SubscriptionPlan updatePlan(String planId, SubscriptionPlanRequest request) {
        SubscriptionPlan plan = subscriptionPlanRepository.findById(planId)
                .orElseThrow(() -> new RuntimeException("Plan not found"));

        if (request.getCode() != null && !request.getCode().isBlank()) {
            plan.setCode(request.getCode());
        }
        if (request.getName() != null) {
            plan.setName(request.getName());
        }
        if (request.getDescription() != null) {
            plan.setDescription(request.getDescription());
        }
        if (request.getDurationDays() != null && request.getDurationDays() > 0) {
            plan.setDurationDays(request.getDurationDays());
        }
        if (request.getPrice() != null) {
            plan.setPrice(request.getPrice());
        }
        if (request.getCurrency() != null) {
            plan.setCurrency(request.getCurrency());
        }
        if (request.getIsActive() != null) {
            plan.setIsActive(request.getIsActive());
        }
        plan.setUpdatedAt(LocalDateTime.now());

        return subscriptionPlanRepository.save(plan);
    }

    public UserSubscription assignPlanToUser(AssignSubscriptionRequest request) {
        if (request.getUserId() == null || request.getUserId().isBlank()) {
            throw new RuntimeException("userId is required");
        }
        Optional<User> user = userRepository.findById(request.getUserId());
        if (user.isEmpty()) {
            throw new RuntimeException("User not found");
        }

        SubscriptionPlan plan = resolvePlan(request.getPlanId(), request.getPlanCode());
        if (plan.getIsActive() == null || !plan.getIsActive()) {
            throw new RuntimeException("Plan is inactive");
        }

        LocalDateTime startAt = request.getStartAt() == null ? LocalDateTime.now() : request.getStartAt();
        LocalDateTime endAt = SubscriptionDateCalculator.calculateEndAt(startAt, plan.getDurationDays());

        List<UserSubscription> activeSubs = userSubscriptionRepository.findByUserIdAndStatus(request.getUserId(), "ACTIVE");
        for (UserSubscription sub : activeSubs) {
            sub.setStatus("REPLACED");
            sub.setCanceledAt(LocalDateTime.now());
            sub.setUpdatedAt(LocalDateTime.now());
        }
        if (!activeSubs.isEmpty()) {
            userSubscriptionRepository.saveAll(activeSubs);
        }

        LocalDateTime now = LocalDateTime.now();
        UserSubscription subscription = UserSubscription.builder()
                .id(UUID.randomUUID().toString())
                .userId(request.getUserId())
                .planId(plan.getId())
                .planCode(plan.getCode())
                .planName(plan.getName())
                .startAt(startAt)
                .endAt(endAt)
                .status("ACTIVE")
                .isTrial("TRIAL".equalsIgnoreCase(plan.getCode()))
                .createdAt(now)
                .updatedAt(now)
                .build();

        return userSubscriptionRepository.save(subscription);
    }

    public UserSubscription updateSubscriptionStatus(String subscriptionId, SubscriptionStatusUpdateRequest request) {
        if (request.getStatus() == null || request.getStatus().isBlank()) {
            throw new RuntimeException("status is required");
        }
        UserSubscription subscription = userSubscriptionRepository.findById(subscriptionId)
                .orElseThrow(() -> new RuntimeException("Subscription not found"));

        subscription.setStatus(request.getStatus());
        if ("CANCELED".equalsIgnoreCase(request.getStatus())) {
            subscription.setCanceledAt(LocalDateTime.now());
        }
        subscription.setUpdatedAt(LocalDateTime.now());

        return userSubscriptionRepository.save(subscription);
    }

    private SubscriptionPlan resolvePlan(String planId, String planCode) {
        if (planId != null && !planId.isBlank()) {
            return subscriptionPlanRepository.findById(planId)
                    .orElseThrow(() -> new RuntimeException("Plan not found"));
        }
        if (planCode != null && !planCode.isBlank()) {
            return subscriptionPlanRepository.findByCode(planCode)
                    .orElseThrow(() -> new RuntimeException("Plan not found"));
        }
        throw new RuntimeException("planId or planCode is required");
    }
}
