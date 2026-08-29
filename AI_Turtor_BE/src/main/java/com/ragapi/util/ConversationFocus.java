package com.ragapi.util;

/**
 * Pulls the last real student question out of tutor chat history so follow-ups
 * ("có ví dụ ko?") stay on that topic during retrieval.
 */
public final class ConversationFocus {

    private ConversationFocus() {
    }

    public static String lastSubstantiveStudentQuestion(String history) {
        if (history == null || history.isBlank()) {
            return "";
        }
        String last = "";
        for (String rawLine : history.split("\\R")) {
            String line = rawLine.trim();
            if (!line.startsWith("- Student:")) {
                continue;
            }
            String question = line.substring("- Student:".length()).trim();
            if (question.isBlank()
                    || StudentChatIntentDetector.isDependentFollowUp(question)
                    || StudentChatIntentDetector.isAllowedInteraction(question)
                    || StudentChatIntentDetector.isOffTopicNonAcademic(question)) {
                continue;
            }
            last = question;
        }
        return last;
    }
}
