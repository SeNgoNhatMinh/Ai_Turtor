package com.ragapi.service;

public record TtsAudioResult(byte[] bytes, String contentType, String fileName) {
}
