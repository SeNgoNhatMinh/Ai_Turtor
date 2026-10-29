package com.ragapi.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseCookie;
import org.springframework.stereotype.Service;

import java.time.Duration;

@Service
public class RefreshTokenCookieService {

    public static final String COOKIE_NAME = "ai_tutor_refresh";
    public static final String COOKIE_PATH = "/api/users";

    private final boolean secure;
    private final Duration lifetime;

    public RefreshTokenCookieService(
            @Value("${security.refresh-token.cookie-secure:false}") boolean secure,
            @Value("${security.refresh-token.expiration-days:30}") long expirationDays
    ) {
        this.secure = secure;
        this.lifetime = Duration.ofDays(Math.max(1, expirationDays));
    }

    public ResponseCookie create(String refreshToken) {
        return baseCookie(refreshToken)
                .maxAge(lifetime)
                .build();
    }

    public ResponseCookie clear() {
        return baseCookie("")
                .maxAge(Duration.ZERO)
                .build();
    }

    private ResponseCookie.ResponseCookieBuilder baseCookie(String value) {
        return ResponseCookie.from(COOKIE_NAME, value)
                .httpOnly(true)
                .secure(secure)
                .sameSite("Lax")
                .path(COOKIE_PATH);
    }
}
