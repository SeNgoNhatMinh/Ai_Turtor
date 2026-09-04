package com.ragapi.service;

import java.util.List;

public interface TtsProvider {

    List<Voice> listVoices();

    GeneratedAudio synthesize(String text, String voice, String language);

    boolean isAvailable();

    record Voice(String id, String name, String language, String description) {
    }

    record GeneratedAudio(byte[] bytes, String contentType) {
    }
}
