package com.ragapi.config;

import com.ragapi.entity.QuestionEscalation;
import com.ragapi.service.MentorEscalationService;
import lombok.AllArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.util.List;

/**
 * MentorEscalationScheduler - Tự �'�Tng offer tư vấn sau 30 giây
 */
@Slf4j
@Component
@EnableScheduling
@AllArgsConstructor
public class MentorEscalationScheduler {
    
    private MentorEscalationService mentorEscalationService;
    
    /**
     * Chạy m�-i 10 giây �'�f check xem có mentor escalation nào cần offer
     * Nếu 30s �'ã qua k�f từ khi user hỏi, thì gửi offer
     */
    @Scheduled(fixedDelay = 10000) // 10 seconds
    public void offerMentorHelpScheduledTask() {
        try {
            log.debug("Running mentor escalation scheduler...");
            
            List<QuestionEscalation> pendingRequests = mentorEscalationService.getPendingQuestionEscalations();

            for (QuestionEscalation request : pendingRequests) {
                try {
                    long actualTime = System.currentTimeMillis();
                    // Check xem �'ã 30s chưa từ lúc user hỏi
                    if (shouldOfferMentorHelp(request.getId(), actualTime)) {
                        mentorEscalationService.offerMentorHelp(request.getId(), request.getUserId());
                        log.info("Mentor help offer sent for request: {}", request.getId());
                    }
                } catch (Exception e) {
                    log.error("Error processing question escalation: {}", request.getId(), e);
                }
            }
        } catch (Exception e) {
            log.error("Error in mentor escalation scheduler", e);
        }
    }
    
    /**
     * Helper - Check xem �'ã 30s chưa k�f từ khi user hỏi
     */
    private boolean shouldOfferMentorHelp(String requestId, long currentTime) {
        // TODO: Implement check logic
        // Lấy request từ DB, tính toán: currentTime - questionAskedAt >= 30000ms (30s)
        return true; // Placeholder
    }
}






