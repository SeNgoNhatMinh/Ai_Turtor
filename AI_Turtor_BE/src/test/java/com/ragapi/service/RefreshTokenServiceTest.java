package com.ragapi.service;

import com.ragapi.entity.AuthRefreshToken;
import com.ragapi.entity.User;
import com.ragapi.repository.AuthRefreshTokenRepository;
import com.ragapi.repository.MentorRepository;
import com.ragapi.repository.UserRepository;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Query;

import java.time.Instant;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class RefreshTokenServiceTest {

    private final AuthRefreshTokenRepository refreshTokenRepository = mock(AuthRefreshTokenRepository.class);
    private final UserRepository userRepository = mock(UserRepository.class);
    private final MentorRepository mentorRepository = mock(MentorRepository.class);
    private final JwtService jwtService = mock(JwtService.class);
    private final MongoTemplate mongoTemplate = mock(MongoTemplate.class);
    private final RefreshTokenService service = new RefreshTokenService(
            refreshTokenRepository,
            userRepository,
            mentorRepository,
            jwtService,
            mongoTemplate,
            30
    );

    @Test
    void rotatesConsumedTokenAndReturnsFreshAccessToken() {
        User user = User.builder()
                .id("student-1")
                .email("student@example.com")
                .fullName("Student One")
                .role("STUDENT")
                .isActive(true)
                .build();
        AuthRefreshToken consumed = AuthRefreshToken.builder()
                .id("refresh-1")
                .userId(user.getId())
                .tokenHash("old-hash")
                .createdAt(Instant.now().minusSeconds(60))
                .expiresAt(Instant.now().plusSeconds(3600))
                .build();

        when(mongoTemplate.findAndRemove(any(Query.class), eq(AuthRefreshToken.class))).thenReturn(consumed);
        when(userRepository.findById(user.getId())).thenReturn(Optional.of(user));
        when(jwtService.generateToken(user)).thenReturn("fresh-access-token");
        when(refreshTokenRepository.save(any(AuthRefreshToken.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

        RefreshTokenService.RefreshedSession session = service.rotate("valid-raw-refresh-token");

        assertThat(session.response().getToken()).isEqualTo("fresh-access-token");
        assertThat(session.response().getUserId()).isEqualTo(user.getId());
        assertThat(session.refreshToken().value()).isNotBlank();
        assertThat(session.refreshToken().value()).isNotEqualTo("valid-raw-refresh-token");

        ArgumentCaptor<AuthRefreshToken> saved = ArgumentCaptor.forClass(AuthRefreshToken.class);
        verify(refreshTokenRepository).save(saved.capture());
        assertThat(saved.getValue().getTokenHash())
                .hasSize(64)
                .doesNotContain(session.refreshToken().value());
        assertThat(saved.getValue().getUserId()).isEqualTo(user.getId());
    }

    @Test
    void rejectsMissingOrAlreadyConsumedToken() {
        when(mongoTemplate.findAndRemove(any(Query.class), eq(AuthRefreshToken.class))).thenReturn(null);

        assertThatThrownBy(() -> service.rotate("already-consumed-token"))
                .isInstanceOf(InvalidRefreshTokenException.class);
        assertThatThrownBy(() -> service.rotate(""))
                .isInstanceOf(InvalidRefreshTokenException.class);
    }
}
