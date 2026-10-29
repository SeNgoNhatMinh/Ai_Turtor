package com.ragapi.config;

import com.ragapi.entity.User;
import com.ragapi.repository.UserRepository;
import com.ragapi.util.StudentCodeAllocator;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;

import java.util.HashSet;
import java.util.List;
import java.util.Set;

@Slf4j
@Component
@RequiredArgsConstructor
public class StudentCodeBackfill {
    private final UserRepository userRepository;

    @EventListener(ApplicationReadyEvent.class)
    public void assignMissingStudentCodes() {
        List<User> users = userRepository.findAll();
        Set<String> used = new HashSet<>();
        List<User> missing = users.stream()
                .filter(user -> StudentCodeAllocator.prefixForRole(user.getRole()) != null)
                .filter(user -> {
                    if (StudentCodeAllocator.matchesRole(user.getStudentCode(), user.getRole())) {
                        used.add(user.getStudentCode());
                        return false;
                    }
                    return true;
                })
                .toList();
        if (missing.isEmpty()) return;
        for (User account : missing) {
            String code = StudentCodeAllocator.allocateForRole(account.getRole(), used::contains);
            used.add(code);
            account.setStudentCode(code);
        }
        userRepository.saveAll(missing);
        log.info("Assigned account codes to {} student, teacher and senior accounts", missing.size());
    }
}
