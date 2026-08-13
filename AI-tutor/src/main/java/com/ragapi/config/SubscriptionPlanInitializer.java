package com.ragapi.config;

import com.ragapi.entity.SubscriptionPlan;
import com.ragapi.repository.SubscriptionPlanRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Slf4j
@Component
@RequiredArgsConstructor
public class SubscriptionPlanInitializer implements CommandLineRunner {
    private final SubscriptionPlanRepository subscriptionPlanRepository;

    @Override
    public void run(String... args) {
        if (subscriptionPlanRepository.count() > 0) {
            return;
        }

        LocalDateTime now = LocalDateTime.now();
        List<SubscriptionPlan> plans = List.of(
                SubscriptionPlan.builder()
                        .id(UUID.randomUUID().toString())
                        .code("TRIAL")
                        .name("Trial 7 days")
                        .description("Free trial for new users")
                        .durationDays(7)
                        .price(0.0)
                        .currency("VND")
                        .isActive(true)
                        .createdAt(now)
                        .updatedAt(now)
                        .build(),
                SubscriptionPlan.builder()
                        .id(UUID.randomUUID().toString())
                        .code("VIP_MONTHLY")
                        .name("VIP monthly")
                        .description("VIP plan billed monthly")
                        .durationDays(30)
                        .price(0.0)
                        .currency("VND")
                        .isActive(true)
                        .createdAt(now)
                        .updatedAt(now)
                        .build(),
                SubscriptionPlan.builder()
                        .id(UUID.randomUUID().toString())
                        .code("PRO_YEARLY")
                        .name("PRO yearly")
                        .description("PRO plan billed yearly")
                        .durationDays(365)
                        .price(0.0)
                        .currency("VND")
                        .isActive(true)
                        .createdAt(now)
                        .updatedAt(now)
                        .build()
        );

        subscriptionPlanRepository.saveAll(plans);
        log.info("Seeded default subscription plans: {}", plans.size());
    }
}
