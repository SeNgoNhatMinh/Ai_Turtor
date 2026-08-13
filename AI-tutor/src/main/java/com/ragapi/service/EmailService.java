package com.ragapi.service;

import lombok.AllArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

/**
 * Simple Email service placeholder. In production replace with JavaMailSender or external provider.
 */
@Slf4j
@Service
@AllArgsConstructor
public class EmailService {

    public void sendEmail(String to, String subject, String body) {
        // For MVP, we log the email. Replace with real email sending in Phase 2.
        log.info("Sending email to {} | subject: {} | body: {}", to, subject, body);
    }
}
