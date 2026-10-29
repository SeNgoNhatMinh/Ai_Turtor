package com.ragapi.entity;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;

@Document(collection = "auth_refresh_tokens")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AuthRefreshToken {

    @Id
    private String id;

    @Indexed(unique = true)
    private String tokenHash;

    @Indexed
    private String userId;

    private Instant createdAt;

    @Indexed
    private Instant expiresAt;
}
