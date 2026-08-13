package com.ragapi.config;

import com.ragapi.entity.Mentor;
import com.ragapi.entity.User;
import com.ragapi.repository.MentorRepository;
import com.ragapi.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;

@Slf4j
@Component
@RequiredArgsConstructor
public class MentorAccountSyncInitializer implements CommandLineRunner {

    private final MentorRepository mentorRepository;
    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    @Override
    public void run(String... args) {
        int synced = 0;
        for (Mentor mentor : mentorRepository.findAll()) {
            if (mentor.getEmail() == null || mentor.getEmail().isBlank()
                    || mentor.getPhone() == null || mentor.getPhone().isBlank()) {
                continue;
            }
            if (mentor.getIsActive() != null && !mentor.getIsActive()) {
                continue;
            }

            LocalDateTime now = LocalDateTime.now();
            String email = mentor.getEmail().trim();
            String defaultPassword = mentor.getPhone().trim();
            User user = userRepository.findByEmail(email)
                    .orElseGet(() -> User.builder()
                            .id(mentor.getId())
                            .email(email)
                            .password(passwordEncoder.encode(defaultPassword))
                            .createdAt(now)
                            .build());

            user.setEmail(email);
            user.setFullName(mentor.getMentorName());
            user.setPhone(mentor.getPhone());
            if (!"TEACHER".equalsIgnoreCase(user.getRole())
                    && !"SENIOR_MENTOR".equalsIgnoreCase(user.getRole())) {
                user.setRole("TEACHER");
            }
            user.setIsActive(true);
            user.setIsEmailVerified(true);
            if (user.getEmailVerifiedAt() == null) {
                user.setEmailVerifiedAt(now);
            }
            if (user.getCreatedAt() == null) {
                user.setCreatedAt(now);
            }
            if (user.getPassword() == null || user.getPassword().isBlank()) {
                user.setPassword(passwordEncoder.encode(defaultPassword));
            } else if (!user.getPassword().startsWith("$2")) {
                user.setPassword(passwordEncoder.encode(user.getPassword()));
            }
            user.setUpdatedAt(now);
            userRepository.save(user);
            synced++;
        }
        if (synced > 0) {
            log.info("Synced {} mentor accounts into users collection", synced);
        }
    }
}
