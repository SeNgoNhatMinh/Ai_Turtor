package com.ragapi.service;

/**
 * Signals that a text chunk exceeded an NVIDIA input or generated-audio payload limit.
 */
public class TtsChunkTooLargeException extends TtsUnavailableException {

    public TtsChunkTooLargeException(String message, Throwable cause) {
        super(message, cause);
    }
}
