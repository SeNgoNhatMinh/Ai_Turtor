package com.ragapi.util;

import java.util.NoSuchElementException;

import org.springframework.http.HttpStatus;
import org.springframework.security.access.AccessDeniedException;

/**
 * HTTP status for an exception caught by a controller's broad {@code catch (Exception e)}.
 *
 * Controllers used to answer every caught exception with 500, so a missing field or an
 * unknown id looked like a server crash (found by the 500-user chaos test). Client
 * mistakes now map to 4xx; only genuine failures stay 500.
 */
public final class ErrorStatus {

    private ErrorStatus() {
    }

    public static HttpStatus of(Throwable error) {
        if (error instanceof IllegalArgumentException) {
            // Includes NumberFormatException and ValidationUtils.requireText failures.
            return HttpStatus.BAD_REQUEST;
        }
        if (error instanceof SecurityException || error instanceof AccessDeniedException) {
            return HttpStatus.FORBIDDEN;
        }
        if (error instanceof NoSuchElementException) {
            return HttpStatus.NOT_FOUND;
        }
        // IllegalStateException stays 500: the code base uses it for provider/embedding/config failures.
        return HttpStatus.INTERNAL_SERVER_ERROR;
    }
}
