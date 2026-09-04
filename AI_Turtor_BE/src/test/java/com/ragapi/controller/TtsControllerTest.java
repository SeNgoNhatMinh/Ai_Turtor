package com.ragapi.controller;

import com.ragapi.dto.TtsReadRequest;
import com.ragapi.entity.ClassSection;
import com.ragapi.entity.CourseEnrollment;
import com.ragapi.repository.ClassSectionRepository;
import com.ragapi.repository.CourseEnrollmentRepository;
import com.ragapi.service.TtsProvider;
import com.ragapi.service.TtsService;
import com.ragapi.service.TtsTextNormalizationService;
import com.ragapi.service.TtsUnavailableException;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class TtsControllerTest {

    private final TtsReadRequest request =
            new TtsReadRequest("message-1", "PRJ301", "SE1832", "Xin chào");

    @Test
    void returnsServiceUnavailableWithoutAffectingTheTextAnswer() {
        CourseEnrollmentRepository enrollments = mock(CourseEnrollmentRepository.class);
        ClassSectionRepository sections = mock(ClassSectionRepository.class);
        TtsProvider provider = mock(TtsProvider.class);
        when(enrollments.findByStudentIdAndCourseIdAndClassId("student-1", "PRJ301", "SE1832"))
                .thenReturn(Optional.of(CourseEnrollment.builder().studentId("student-1").build()));
        when(sections.findByCourseIdAndClassId("PRJ301", "SE1832"))
                .thenReturn(Optional.of(ClassSection.builder().teacherId("teacher-1").build()));
        when(provider.isAvailable()).thenReturn(true);
        when(provider.listVoices()).thenReturn(List.of(
                new TtsProvider.Voice("vi-VN-voice-1", "Giọng 1", "vi-VN", "")));
        when(provider.synthesize(anyString(), eq("vi-VN-voice-1"), anyString()))
                .thenThrow(new TtsUnavailableException(
                        "Không thể tạo giọng đọc lúc này. Vui lòng thử lại sau."));
        TtsTextNormalizationService normalizer = new TtsTextNormalizationService();
        ReflectionTestUtils.setField(normalizer, "maxTextLength", 6000);
        ReflectionTestUtils.setField(normalizer, "maxChunkLength", 1900);
        TtsController controller = new TtsController(
                new TtsService(normalizer, provider, enrollments, sections));

        var response = controller.synthesize(request, authentication("ROLE_STUDENT"));

        assertEquals(HttpStatus.SERVICE_UNAVAILABLE, response.getStatusCode());
        assertEquals("TTS_UNAVAILABLE", body(response.getBody()).get("code"));
    }

    @Test
    void rejectsSynthesisForANonStudentRole() {
        TtsController controller = new TtsController(null);

        var response = controller.synthesize(request, authentication("ROLE_TEACHER"));

        assertEquals(HttpStatus.FORBIDDEN, response.getStatusCode());
        assertEquals("TTS_FORBIDDEN", body(response.getBody()).get("code"));
    }

    private UsernamePasswordAuthenticationToken authentication(String role) {
        return new UsernamePasswordAuthenticationToken(
                "student-1", "", List.of(new SimpleGrantedAuthority(role)));
    }

    @SuppressWarnings("unchecked")
    private Map<String, String> body(Object body) {
        return (Map<String, String>) body;
    }
}
