package com.ragapi.service;

import com.ragapi.dto.TtsReadRequest;
import com.ragapi.entity.ClassSection;
import com.ragapi.entity.CourseEnrollment;
import com.ragapi.repository.ClassSectionRepository;
import com.ragapi.repository.CourseEnrollmentRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.List;
import java.util.Optional;
import java.util.concurrent.atomic.AtomicInteger;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class TtsServiceTest {

    private CourseEnrollmentRepository enrollmentRepository;
    private ClassSectionRepository classSectionRepository;
    private TtsProvider provider;
    private TtsTextNormalizationService normalizationService;
    private TtsService service;

    @BeforeEach
    void setUp() {
        enrollmentRepository = mock(CourseEnrollmentRepository.class);
        classSectionRepository = mock(ClassSectionRepository.class);
        provider = mock(TtsProvider.class);
        normalizationService = new TtsTextNormalizationService();
        ReflectionTestUtils.setField(normalizationService, "maxTextLength", 6000);
        ReflectionTestUtils.setField(normalizationService, "maxChunkLength", 1900);
        service = new TtsService(normalizationService, provider, enrollmentRepository, classSectionRepository);
        when(provider.isAvailable()).thenReturn(true);
        when(provider.listVoices()).thenReturn(List.of(
                new TtsProvider.Voice("vi-VN-voice-1", "Giọng 1", "vi-VN", ""),
                new TtsProvider.Voice("vi-VN-voice-2", "Giọng 2", "vi-VN", "")
        ));
        allowStudentScope();
    }

    @Test
    void usesSelectedProviderVoice() {
        byte[] wav = WavAudioUtils.ensurePcmWav(new byte[]{1, 2}, 44_100);
        when(provider.synthesize("Xin chào", "vi-VN-voice-2", "vi-VN"))
                .thenReturn(new TtsProvider.GeneratedAudio(wav, "audio/wav"));
        TtsReadRequest request = new TtsReadRequest(
                "message-1", "PRJ301", "SE1832", "Xin chào", "vi-VN-voice-2");

        TtsAudioResult result = service.readAiAnswer(request, "student-1");

        assertEquals("audio/wav", result.contentType());
        verify(provider).synthesize("Xin chào", "vi-VN-voice-2", "vi-VN");
    }

    @Test
    void listsProviderCatalogDirectlyForAnEnrolledStudent() {
        var voices = service.listStudentVoices("student-1", "PRJ301", "SE1832");

        assertEquals(List.of("vi-VN-voice-1", "vi-VN-voice-2"),
                voices.stream().map(value -> value.providerVoiceId()).toList());
    }

    @Test
    void fallsBackToFirstAvailableVoiceWhenSelectionIsMissingOrStale() {
        byte[] wav = WavAudioUtils.ensurePcmWav(new byte[]{1, 2}, 44_100);
        when(provider.synthesize("Xin chào", "vi-VN-voice-1", "vi-VN"))
                .thenReturn(new TtsProvider.GeneratedAudio(wav, "audio/wav"));

        service.readAiAnswer(new TtsReadRequest(
                "message-1", "PRJ301", "SE1832", "Xin chào", "old-profile-id"), "student-1");

        verify(provider).synthesize("Xin chào", "vi-VN-voice-1", "vi-VN");
    }

    @Test
    void splitsLongTextAndConcatenatesWavChunks() {
        ReflectionTestUtils.setField(normalizationService, "maxChunkLength", 100);
        byte[] wav = WavAudioUtils.ensurePcmWav(new byte[]{1, 2}, 44_100);
        when(provider.synthesize(anyString(), eq("vi-VN-voice-1"), eq("vi-VN")))
                .thenReturn(new TtsProvider.GeneratedAudio(wav, "audio/wav"));
        String text = ("Câu này giải thích bài học thật rõ ràng. ").repeat(8);

        TtsAudioResult result = service.readAiAnswer(
                new TtsReadRequest("message-1", "PRJ301", "SE1832", text), "student-1");

        assertEquals((byte) 'R', result.bytes()[0]);
        verify(provider, times(4)).synthesize(anyString(), eq("vi-VN-voice-1"), eq("vi-VN"));
    }

    @Test
    void rejectsStudentWhoIsNotEnrolledBeforeCallingProvider() {
        when(enrollmentRepository.findByStudentIdAndCourseIdAndClassId("student-2", "PRJ301", "SE1832"))
                .thenReturn(Optional.empty());

        assertThrows(SecurityException.class, () -> service.readAiAnswer(
                new TtsReadRequest("message-1", "PRJ301", "SE1832", "Xin chào"), "student-2"));
    }

    @Test
    void retriesWithSmallerChunksWhenProviderNormalizationExpandsTextPastLimit() {
        ReflectionTestUtils.setField(normalizationService, "maxChunkLength", 1200);
        byte[] wav = WavAudioUtils.ensurePcmWav(new byte[]{1, 2}, 44_100);
        AtomicInteger calls = new AtomicInteger();
        when(provider.synthesize(anyString(), eq("vi-VN-voice-1"), eq("vi-VN"))).thenAnswer(invocation -> {
            calls.incrementAndGet();
            String chunk = invocation.getArgument(0);
            if (chunk.length() > 400) {
                throw new TtsChunkTooLargeException("provider chunk is too large", null);
            }
            return new TtsProvider.GeneratedAudio(wav, "audio/wav");
        });
        String text = ("Hàm print hiển thị dữ liệu và chuyển các ký hiệu thành lời đọc. ").repeat(10);

        TtsAudioResult result = service.readAiAnswer(
                new TtsReadRequest("message-1", "PRJ301", "SE1832", text), "student-1");

        assertEquals((byte) 'R', result.bytes()[0]);
        assertTrue(calls.get() >= 3);
    }

    private void allowStudentScope() {
        when(enrollmentRepository.findByStudentIdAndCourseIdAndClassId("student-1", "PRJ301", "SE1832"))
                .thenReturn(Optional.of(CourseEnrollment.builder().studentId("student-1").build()));
        when(classSectionRepository.findByCourseIdAndClassId("PRJ301", "SE1832"))
                .thenReturn(Optional.of(ClassSection.builder().teacherId("teacher-1").build()));
    }
}
