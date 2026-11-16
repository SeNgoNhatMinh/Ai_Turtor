package com.ragapi.util;

import com.ragapi.dto.IntentClassification;
import com.ragapi.service.IntentClassifierService;

/**
 * Single routing policy for the tutor harness.
 * A greeting opens the curriculum. Other non-academic chat is refused.
 * Course retrieval and mentor tickets are not workers for those turns.
 */
public final class HarnessRoutePolicy {

    private HarnessRoutePolicy() {
    }

    public static boolean isCurriculumTurn(String message) {
        return StudentChatIntentDetector.isGreeting(message);
    }

    public static boolean mustStayOffCourseMaterial(String message) {
        if (isCurriculumTurn(message)) {
            return false;
        }
        return StudentChatIntentDetector.isOffTopicNonAcademic(message)
                || StudentChatIntentDetector.isAllowedInteraction(message)
                || StudentChatIntentDetector.isIncompleteOrMeaningless(message);
    }

    public static boolean isRefuseDecision(IntentClassification intent) {
        if (intent == null || intent.getMode() == null) {
            return false;
        }
        if (IntentClassifierService.MODE_REFUSE.equals(intent.getMode())) {
            return true;
        }
        String subIntent = intent.getSubIntent() == null ? "" : intent.getSubIntent();
        return IntentClassifierService.MODE_RAG.equals(intent.getMode())
                && ("OFF_TOPIC".equals(subIntent) || "CONVERSATIONAL".equals(subIntent))
                && !Boolean.TRUE.equals(intent.getRequiresCourseMaterial());
    }

    public static void forceRefuse(IntentClassification intent) {
        intent.setMode(IntentClassifierService.MODE_REFUSE);
        intent.setSubIntent("OFF_TOPIC");
        intent.setRequiresCourseMaterial(false);
        intent.setAnswerPolicy("Refuse non-academic chat. Ask for a course question instead.");
    }
}
