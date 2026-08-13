package com.ragapi.service;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Map;
import java.util.Random;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Authentication utilities: send and verify OTP.
 * This is a lightweight, in-memory OTP implementation for Phase 1/2.
 * Replace with persistent or provider-based implementation for production.
 */
@Slf4j
@Service
@AllArgsConstructor
public class AuthService {

    private final EmailService emailService;

    private final Map<String, OtpEntry> otpStore = new ConcurrentHashMap<>();
    private final Random random = new Random();

    @Getter
    static class OtpEntry {
        final String otp;
        final Instant expiresAt;

        OtpEntry(String otp, Instant expiresAt) {
            this.otp = otp;
            this.expiresAt = expiresAt;
        }
    }

    /**
     * Send OTP to email. Returns true if sent (for testing it returns true always).
     */
    public boolean sendOtp(String email) {
        String otp = String.format("%06d", random.nextInt(1_000_000));
        Instant expiresAt = Instant.now().plus(10, ChronoUnit.MINUTES);
        otpStore.put(email, new OtpEntry(otp, expiresAt));

        // Send via EmailService (currently logs)
        String subject = "[AI Tutor Platform] Verification OTP";
        String body = "Your verification OTP is: " + otp + " (valid 10 minutes)";
        emailService.sendEmail(email, subject, body);

        log.info("OTP generated for {} (expires at {})", email, expiresAt);
        return true;
    }

    /**
     * Verify OTP for email. Returns true if valid; removes OTP on success.
     */
    public boolean verifyOtp(String email, String otp) {
        OtpEntry entry = otpStore.get(email);
        if (entry == null) return false;
        if (Instant.now().isAfter(entry.expiresAt)) {
            otpStore.remove(email);
            return false;
        }
        if (!entry.otp.equals(otp)) return false;
        otpStore.remove(email);
        return true;
    }

}
