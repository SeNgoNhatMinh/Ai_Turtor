package com.ragapi.util;

import com.ragapi.service.IntentClassifierService;

/**
 * Maps n8n Switch output onto backend tutor modes without changing FE fallback behavior.
 */
public final class HarnessRouting {

    private HarnessRouting() {
    }

    /**
     * @return RAG, CODE, ESCALATE, or null when n8n did not pre-route
     */
    public static String normalizeMode(String raw) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        String mode = raw.trim().toUpperCase();
        if ("RAG_TUTOR".equals(mode) || "COURSE_AI".equals(mode) || IntentClassifierService.MODE_RAG.equals(mode)) {
            return IntentClassifierService.MODE_RAG;
        }
        if ("CODE_MENTOR".equals(mode) || IntentClassifierService.MODE_CODE.equals(mode)) {
            return IntentClassifierService.MODE_CODE;
        }
        if (IntentClassifierService.MODE_ESCALATE.equals(mode)) {
            return IntentClassifierService.MODE_ESCALATE;
        }
        return null;
    }
}
