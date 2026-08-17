package com.ragapi.service;

import com.ragapi.dto.CodeMentorRequest;
import com.ragapi.entity.StudentCourseMemory;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.ArrayList;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class CodeMentorServiceTest {

    @Mock
    private OpenRouterChatService chatService;
    @Mock
    private StudentCourseMemoryService memoryService;
    @Mock
    private AiConversationService conversationService;
    @Mock
    private CanonicalTutorAnswerCacheService answerCacheService;

    @Test
    void storesVietnameseQuestionTogetherWithCodeSnippet() {
        CodeMentorRequest request = new CodeMentorRequest();
        request.setStudentId("student-1");
        request.setCourseId("PRO192");
        request.setClassId("SE1840");
        request.setQuestion("Đoạn Java sau bị lỗi gì? Hãy hướng dẫn em tự sửa.");
        request.setCode("int x = \"10\";");

        StudentCourseMemory memory = new StudentCourseMemory();
        memory.setWeakTopics(new ArrayList<>());
        when(chatService.generate(any())).thenReturn("Biến int không thể nhận trực tiếp một String.");
        when(memoryService.getOrCreateMemory("student-1", "PRO192")).thenReturn(memory);
        when(conversationService.saveExchange(eq("student-1"), any(), any(), any(), any()))
                .thenReturn("conversation-1");

        new CodeMentorService(chatService, memoryService, conversationService, answerCacheService).mentor(request);

        ArgumentCaptor<String> storedQuestion = ArgumentCaptor.forClass(String.class);
        verify(memoryService).recordInteraction(
                eq("student-1"),
                eq("PRO192"),
                eq("SE1840"),
                storedQuestion.capture(),
                any()
        );

        String value = storedQuestion.getValue();
        assertTrue(value.contains("Đoạn Java sau bị lỗi gì? Hãy hướng dẫn em tự sửa."));
        assertTrue(value.contains("Code/error log:"));
        assertTrue(value.contains("int x = \"10\";"));
        assertEquals(-1, value.indexOf('\uFFFD'));
    }
}
