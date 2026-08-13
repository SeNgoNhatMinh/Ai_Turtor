package com.ragapi.config;

import com.ragapi.entity.User;
import com.ragapi.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;
import java.util.UUID;

@Slf4j
@Component
@RequiredArgsConstructor
public class AdminAccountInitializer implements CommandLineRunner {
    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    @Value("${admin.account.email:admin@system.local}")
    private String adminEmail;

    @Value("${admin.account.password:admin123}")
    private String adminPassword;

    @Value("${admin.account.full-name:System Admin}")
    private String adminFullName;

    @Override
    public void run(String... args) {
        var existingAdmin = userRepository.findByEmail(adminEmail);
        if (existingAdmin.isPresent()) {
            User admin = existingAdmin.get();
            if (admin.getPassword() != null && !admin.getPassword().startsWith("$2")) {
                admin.setPassword(passwordEncoder.encode(adminPassword));
                admin.setUpdatedAt(LocalDateTime.now());
                userRepository.save(admin);
                log.info("Admin account password hash repaired: {}", adminEmail);
            }
            return;
        }

        LocalDateTime now = LocalDateTime.now();
        User admin = User.builder()
                .id(UUID.randomUUID().toString())
                .email(adminEmail)
                .password(passwordEncoder.encode(adminPassword))
                .fullName(adminFullName)
                .role("ADMIN")
                .isActive(true)
                .isEmailVerified(true)
                .emailVerifiedAt(now)
                .createdAt(now)
                .updatedAt(now)
                .build();

        userRepository.save(admin);
        log.info("Admin account created: {}", adminEmail);
    }
}
