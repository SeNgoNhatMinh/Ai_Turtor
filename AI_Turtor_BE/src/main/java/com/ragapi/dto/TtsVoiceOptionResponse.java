package com.ragapi.dto;

import com.ragapi.service.TtsProvider;

public record TtsVoiceOptionResponse(
        String id,
        String name,
        String providerVoiceId,
        String language,
        String description
) {
    public static TtsVoiceOptionResponse providerVoice(TtsProvider.Voice voice) {
        return new TtsVoiceOptionResponse(
                voice.id(), voice.name(), voice.id(), voice.language(), voice.description());
    }
}
