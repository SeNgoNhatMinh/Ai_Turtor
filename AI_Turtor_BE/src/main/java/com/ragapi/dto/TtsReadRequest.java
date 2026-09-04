package com.ragapi.dto;

public record TtsReadRequest(
        String messageId,
        String courseId,
        String classId,
        String text,
        String providerVoiceId,
        String voiceId
) {
    public TtsReadRequest(String messageId, String courseId, String classId, String text) {
        this(messageId, courseId, classId, text, null, null);
    }

    public TtsReadRequest(String messageId, String courseId, String classId, String text, String providerVoiceId) {
        this(messageId, courseId, classId, text, providerVoiceId, null);
    }

    public String selectedProviderVoiceId() {
        return providerVoiceId == null || providerVoiceId.isBlank() ? voiceId : providerVoiceId;
    }
}
