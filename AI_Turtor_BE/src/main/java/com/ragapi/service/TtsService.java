package com.ragapi.service;

import com.ragapi.dto.TtsReadRequest;
import com.ragapi.dto.TtsVoiceOptionResponse;
import com.ragapi.repository.ClassSectionRepository;
import com.ragapi.repository.CourseEnrollmentRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;

@Service
@RequiredArgsConstructor
public class TtsService {

    private static final String DEFAULT_LANGUAGE = "vi-VN";

    private final TtsTextNormalizationService normalizationService;
    private final TtsProvider provider;
    private final CourseEnrollmentRepository enrollmentRepository;
    private final ClassSectionRepository classSectionRepository;

    public TtsAudioResult readAiAnswer(TtsReadRequest request, String studentId) {
        if (request == null) throw new IllegalArgumentException("Request is required");
        validateStudentScope(studentId, request.courseId(), request.classId());
        ResolvedVoice voice = resolveProviderVoice(request.selectedProviderVoiceId());
        List<String> chunks = normalizationService.normalizeAndChunk(request.text());
        if (chunks.isEmpty()) throw new IllegalArgumentException("AI answer does not contain speakable text");

        List<byte[]> audioChunks = new ArrayList<>(chunks.size());
        for (String chunk : chunks) {
            synthesizeChunk(chunk, voice, audioChunks, 0);
        }
        return new TtsAudioResult(WavAudioUtils.concatenate(audioChunks), "audio/wav", "ai-tutor-answer.wav");
    }

    private void synthesizeChunk(
            String chunk,
            ResolvedVoice voice,
            List<byte[]> audioChunks,
            int retryDepth
    ) {
        try {
            TtsProvider.GeneratedAudio audio = provider.synthesize(
                    chunk, voice.providerVoiceId(), voice.language());
            audioChunks.add(audio.bytes());
        } catch (TtsChunkTooLargeException error) {
            if (retryDepth >= 4) throw error;
            List<String> retryChunks = normalizationService.splitForProviderRetry(chunk);
            if (retryChunks.size() <= 1) throw error;
            for (String retryChunk : retryChunks) {
                synthesizeChunk(retryChunk, voice, audioChunks, retryDepth + 1);
            }
        }
    }

    public List<TtsVoiceOptionResponse> listStudentVoices(String studentId, String courseId, String classId) {
        validateStudentScope(studentId, courseId, classId);
        return availableVoices().stream().map(TtsVoiceOptionResponse::providerVoice).toList();
    }

    private ResolvedVoice resolveProviderVoice(String selectedVoiceId) {
        List<TtsProvider.Voice> voices = availableVoices();
        String selected = safe(selectedVoiceId);
        TtsProvider.Voice voice = voices.stream()
                .filter(candidate -> candidate.id().equals(selected))
                .findFirst()
                .orElse(voices.get(0));
        String language = safe(voice.language());
        return new ResolvedVoice(voice.id(), language.isBlank() ? DEFAULT_LANGUAGE : language);
    }

    private List<TtsProvider.Voice> availableVoices() {
        if (!provider.isAvailable()) {
            throw new TtsUnavailableException("TTS is disabled or NVIDIA_API_KEY is not configured");
        }
        List<TtsProvider.Voice> voices = provider.listVoices();
        if (voices == null || voices.isEmpty()) {
            throw new TtsUnavailableException("NVIDIA Magpie did not return a Vietnamese voice");
        }
        return voices;
    }

    private void validateStudentScope(String studentId, String courseId, String classId) {
        String safeStudentId = required(studentId, "studentId");
        String safeCourseId = required(courseId, "courseId");
        String safeClassId = required(classId, "classId");
        if (enrollmentRepository.findByStudentIdAndCourseIdAndClassId(
                safeStudentId, safeCourseId, safeClassId).isEmpty()) {
            throw new SecurityException("Student is not enrolled in this course and class");
        }
        if (classSectionRepository.findByCourseIdAndClassId(safeCourseId, safeClassId).isEmpty()) {
            throw new IllegalArgumentException("Class section not found");
        }
    }

    private String required(String value, String field) {
        String safe = safe(value);
        if (safe.isBlank()) throw new IllegalArgumentException(field + " is required");
        return safe;
    }

    private String safe(String value) {
        return value == null ? "" : value.trim();
    }

    private record ResolvedVoice(String providerVoiceId, String language) {
    }
}
