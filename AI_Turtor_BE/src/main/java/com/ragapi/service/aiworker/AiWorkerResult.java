package com.ragapi.service.aiworker;

/**
 * A worker result is independent from sibling worker outcomes so callers can
 * preserve successful work when another task fails.
 */
public record AiWorkerResult<T>(
        Status status,
        T value,
        String error,
        long durationMs
) {
    public enum Status {
        SUCCESS,
        FAILED,
        TIMED_OUT,
        REJECTED
    }

    public static <T> AiWorkerResult<T> success(T value, long durationMs) {
        return new AiWorkerResult<>(Status.SUCCESS, value, null, durationMs);
    }

    public static <T> AiWorkerResult<T> failed(String error, long durationMs) {
        return new AiWorkerResult<>(Status.FAILED, null, safeMessage(error), durationMs);
    }

    public static <T> AiWorkerResult<T> timedOut(long durationMs) {
        return new AiWorkerResult<>(Status.TIMED_OUT, null, "Worker timed out", durationMs);
    }

    public static <T> AiWorkerResult<T> rejected(String error) {
        return new AiWorkerResult<>(Status.REJECTED, null, safeMessage(error), 0);
    }

    private static String safeMessage(String message) {
        if (message == null || message.isBlank()) {
            return "Worker failed";
        }
        return message.length() <= 240 ? message : message.substring(0, 240);
    }
}
