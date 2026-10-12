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
                .filter(user -> "STUDENT".equalsIgnoreCase(user.getRole()))
                .filter(user -> {
                    if (StudentCodeAllocator.isStudentCode(user.getStudentCode())) {
                        used.add(user.getStudentCode());
                        return false;
                    }
                    return true;
                })
                .toList();
        if (missing.isEmpty()) return;
        for (User student : missing) {
            String code = StudentCodeAllocator.allocate(used::contains);
            used.add(code);
            student.setStudentCode(code);
        }
        userRepository.saveAll(missing);
        log.info("Assigned student codes to {} existing student accounts", missing.size());
    }
}
