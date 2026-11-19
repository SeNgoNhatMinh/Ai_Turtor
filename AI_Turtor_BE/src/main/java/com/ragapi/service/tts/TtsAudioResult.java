package com.ragapi.service.tts;

public record TtsAudioResult(byte[] bytes, String contentType, String fileName) {
}
