package com.ragapi.service;

import org.junit.jupiter.api.Test;
import org.springframework.http.ResponseCookie;

import static org.assertj.core.api.Assertions.assertThat;

class RefreshTokenCookieServiceTest {

    @Test
    void createsHttpOnlySecureSameSiteCookieForProduction() {
        RefreshTokenCookieService service = new RefreshTokenCookieService(true, 30);

        ResponseCookie cookie = service.create("raw-token");

        assertThat(cookie.isHttpOnly()).isTrue();
        assertThat(cookie.isSecure()).isTrue();
        assertThat(cookie.getSameSite()).isEqualTo("Lax");
        assertThat(cookie.getPath()).isEqualTo("/api/users");
        assertThat(cookie.getMaxAge().toDays()).isEqualTo(30);
    }

    @Test
    void clearsCookieUsingTheSameNameAndPath() {
        RefreshTokenCookieService service = new RefreshTokenCookieService(false, 30);

        ResponseCookie cookie = service.clear();

        assertThat(cookie.getName()).isEqualTo(RefreshTokenCookieService.COOKIE_NAME);
        assertThat(cookie.getPath()).isEqualTo(RefreshTokenCookieService.COOKIE_PATH);
        assertThat(cookie.getMaxAge().isZero()).isTrue();
    }
}
