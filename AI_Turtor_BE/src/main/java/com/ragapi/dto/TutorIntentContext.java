package com.ragapi.dto;

/**
 * Optional chat/session context for intent routing. Empty values mean
 * "classify this message alone" — the same as the previous 3-argument classify().
 */
public record TutorIntentContext(String recentHistory, String sessionPhase, String sessionTopic) {

    public static TutorIntentContext none() {
        return new TutorIntentContext("", null, null);
    }

    public String recentHistory() {
        return recentHistory == null ? "" : recentHistory;
    }

    /**
     * True only when the student is inside a numbered lesson / tutor session.
     * Ordinary Q and A history is not enough: a follow-up after a concept question
     * should stay on that concept, not restart a "Bắt đầu bài" lesson.
     */
    public boolean hasTeachContext() {
        if (sessionTopic != null && !sessionTopic.isBlank()) {
            return true;
        }
        if (sessionPhase != null) {
            String phase = sessionPhase.trim().toUpperCase();
            if ("TEACH".equals(phase) || "PRACTICE".equals(phase)
                    || "DIAGNOSTIC".equals(phase) || "REFLECT".equals(phase)) {
                return true;
            }
        }
        String history = recentHistory();
        return history.contains("Bắt đầu bài")
                || history.contains("Bài 1")
                || history.contains("Lộ trình");
    }
}
