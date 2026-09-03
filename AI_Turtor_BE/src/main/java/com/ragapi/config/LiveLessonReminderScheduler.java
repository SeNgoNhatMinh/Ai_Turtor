package com.ragapi.config;

import com.ragapi.service.LiveLessonService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Slf4j
@Component
@RequiredArgsConstructor
public class LiveLessonReminderScheduler {

    private final LiveLessonService liveLessonService;

    @Scheduled(fixedDelay = 30000)
    public void remindStudentsBeforeStart() {
        try {
            liveLessonService.sendUpcomingReminders();
        } catch (Exception e) {
            log.warn("Live lesson reminder sweep failed: {}", e.getMessage());
        }
    }
}
