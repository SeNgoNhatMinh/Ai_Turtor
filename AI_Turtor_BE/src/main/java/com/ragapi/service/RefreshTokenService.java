package com.ragapi.service;

import com.ragapi.dto.UserLoginResponse;
import com.ragapi.entity.AuthRefreshToken;
import com.ragapi.entity.Mentor;
import com.ragapi.entity.User;
import com.ragapi.repository.AuthRefreshTokenRepository;
import com.ragapi.repository.MentorRepository;
import com.ragapi.repository.UserRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.HexFormat;

@Service
public class RefreshTokenService {

    private static final int TOKEN_BYTES = 48;

    private final AuthRefreshTokenRepository refreshTokenRepository;
    private final UserRepository userRepository;
    private final MentorRepository mentorRepository;
    private final JwtService jwtService;
    private final MongoTemplate mongoTemplate;
    private final Duration lifetime;
    private final SecureRandom secureRandom = new SecureRandom();

    public RefreshTokenService(
            AuthRefreshTokenRepository refreshTokenRepository,
            UserRepository userRepository,
            MentorRepository mentorRepository,
            JwtService jwtService,
            MongoTemplate mongoTemplate,
            @Value("${security.refresh-token.expiration-days:30}") long expirationDays
    ) {
        this.refreshTokenRepository = refreshTokenRepository;
        this.userRepository = userRepository;
        this.mentorRepository = mentorRepository;
        this.jwtService = jwtService;
        this.mongoTemplate = mongoTemplate;
        this.lifetime = Duration.ofDays(Math.max(1, expirationDays));
    }

    public IssuedRefreshToken issue(String userId) {
        if (userId == null || userId.isBlank()) {
            throw new IllegalArgumentException("userId is required");
        }
        refreshTokenRepository.deleteAllByExpiresAtBefore(Instant.now());
        return createAndSave(userId, Instant.now());
    }

    public RefreshedSession rotate(String rawToken) {
        Instant now = Instant.now();
        AuthRefreshToken consumed = mongoTemplate.findAndRemove(
                Query.query(Criteria.where("tokenHash").is(hash(rawToken)).and("expiresAt").gt(now)),
                AuthRefreshToken.class
        );
        if (consumed == null) {
            throw new InvalidRefreshTokenException();
        }

        UserLoginResponse response = createCurrentLoginResponse(consumed.getUserId());
        IssuedRefreshToken replacement = createAndSave(consumed.getUserId(), now);
        return new RefreshedSession(response, replacement);
    }

    public void revoke(String rawToken) {
        if (rawToken == null || rawToken.isBlank()) return;
        mongoTemplate.findAndRemove(
                Query.query(Criteria.where("tokenHash").is(hash(rawToken))),
                AuthRefreshToken.class
        );
    }

    public void revokeAllForUser(String userId) {
        if (userId == null || userId.isBlank()) return;
        refreshTokenRepository.deleteAllByUserId(userId);
    }

    private IssuedRefreshToken createAndSave(String userId, Instant now) {
        byte[] bytes = new byte[TOKEN_BYTES];
        secureRandom.nextBytes(bytes);
        String rawToken = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
        Instant expiresAt = now.plus(lifetime);
        refreshTokenRepository.save(AuthRefreshToken.builder()
                .tokenHash(hash(rawToken))
                .userId(userId)
                .createdAt(now)
                .expiresAt(expiresAt)
                .build());
        return new IssuedRefreshToken(rawToken, expiresAt);
    }

    private UserLoginResponse createCurrentLoginResponse(String userId) {
        User user = userRepository.findById(userId)
                .filter(candidate -> candidate.getIsActive() == null || candidate.getIsActive())
                .orElse(null);
        if (user != null) {
            return UserLoginResponse.builder()
                    .userId(user.getId())
                    .email(user.getEmail())
                    .fullName(user.getFullName())
                    .avatarUrl(user.getAvatarUrl())
                    .role(user.getRole())
                    .token(jwtService.generateToken(user))
                    .message("Làm mới phiên đăng nhập thành công")
                    .build();
        }

        Mentor mentor = mentorRepository.findById(userId)
                .filter(candidate -> candidate.getIsActive() == null || candidate.getIsActive())
                .orElseThrow(InvalidRefreshTokenException::new);
        return UserLoginResponse.builder()
                .userId(mentor.getId())
                .email(mentor.getEmail())
                .fullName(mentor.getMentorName())
                .avatarUrl(mentor.getAvatarUrl())
                .role("TEACHER")
                .token(jwtService.generateToken(
                        mentor.getId(), mentor.getEmail(), mentor.getMentorName(), "TEACHER"
                ))
                .message("Làm mới phiên đăng nhập thành công")
                .build();
    }

    private String hash(String rawToken) {
        if (rawToken == null || rawToken.isBlank()) {
            throw new InvalidRefreshTokenException();
        }
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256")
                    .digest(rawToken.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(digest);
        } catch (Exception exception) {
            throw new IllegalStateException("Cannot hash refresh token", exception);
        }
    }

    public record IssuedRefreshToken(String value, Instant expiresAt) {}

    public record RefreshedSession(UserLoginResponse response, IssuedRefreshToken refreshToken) {}
}
