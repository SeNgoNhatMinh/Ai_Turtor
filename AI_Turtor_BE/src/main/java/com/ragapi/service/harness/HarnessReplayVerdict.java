package com.ragapi.service.harness;

/** Compares a failed run with the automatic replay. No extra model call. */
public final class HarnessReplayVerdict {
    private HarnessReplayVerdict() {
    }

    public static String decide(boolean escalated, String answer) {
        String text = answer == null ? "" : answer.trim();
        return text.length() >= 40 && !escalated ? "BETTER" : "WORSE";
    }

    public static String note(String verdict) {
        if ("BETTER".equals(verdict)) {
            return "Lần chạy lại trả lời được và không chuyển giáo viên.";
        }
        return "Lần chạy lại vẫn không trả lời được hoặc vẫn phải chuyển giáo viên.";
    }
}
