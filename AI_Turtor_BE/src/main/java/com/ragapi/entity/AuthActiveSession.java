package com.ragapi.entity;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;

/** The one session an account may use. Signing in elsewhere replaces it. */
@Document(collection = "auth_active_sessions")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AuthActiveSession {

    /** The user or mentor id. */
    @Id
    private String userId;

    private String sessionId;

    private Instant startedAt;
}
