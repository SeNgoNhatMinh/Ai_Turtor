package com.ragapi.service;

import com.ragapi.dto.RagQueryIntent;
import com.ragapi.dto.RagSourceEvidence;
import com.ragapi.dto.UnderstandingCheckResultResponse;
import com.ragapi.entity.AiConversation;
import com.ragapi.entity.AiMessage;
import com.ragapi.repository.AiConversationRepository;
import com.ragapi.repository.AiMessageRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class AiConversationServiceUnderstandingCheckTest {

    private AiConversationRepository conversationRepository;
    private AiMessageRepository messageRepository;
    private AiConversationService service;

    @BeforeEach
    void setUp() {
        conversationRepository = mock(AiConversationRepository.class);
        messageRepository = mock(AiMessageRepository.class);
        service = new AiConversationService(conversationRepository, messageRepository);
        when(conversationRepository.findByIdAndUserId("conversation-1", "student-1"))
                .thenReturn(Optional.of(AiConversation.builder()
                        .id("conversation-1")
                        .userId("student-1")
                        .build()));
        when(messageRepository.save(any(AiMessage.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));
    }

    @Test
    void gradesOnceAndKeepsTheFirstSelectionOnRetry() {
        AiMessage message = understandingMessage();
        when(messageRepository.findByIdAndConversationIdAndUserId(
                "assistant-1", "conversation-1", "student-1"))
                .thenReturn(Optional.of(message));

        UnderstandingCheckResultResponse first = service.recordUnderstandingCheck(
                "conversation-1", "assistant-1", "student-1", "C");
        UnderstandingCheckResultResponse retry = service.recordUnderstandingCheck(
                "conversation-1", "assistant-1", "student-1", "B");

        assertFalse(first.isCorrect());
        assertEquals("INCORRECT", first.getStatus());
        assertEquals("Gọi ViewResolver", first.getCorrectOptionText());
        assertEquals("C", retry.getSelectedKey());
        assertEquals(first.getAttemptId(), retry.getAttemptId());
    }

    @Test
    void buildsRemediationIntentFromTheOriginatingEvidence() {
        AiMessage message = understandingMessage();
        message.setUnderstandingAttemptId("attempt-1");
        message.setUnderstandingCorrect(false);
        message.setSourceEvidence(List.of(RagSourceEvidence.builder()
                .materialId("material-1")
                .chunkId("chunk-1")
                .build()));
        when(messageRepository.findById("assistant-1")).thenReturn(Optional.of(message));

        RagQueryIntent intent = service.buildUnderstandingRemediationIntent(
                "assistant-1", "attempt-1", "student-1", "fallback");

        assertEquals(List.of("material-1"), intent.getSourceMaterialIds());
        assertEquals(List.of("chunk-1"), intent.getSourceChunkIds());
        assertEquals("Khi controller trả về home, Spring làm gì?", intent.getRetrievalQuery());
    }

    private AiMessage understandingMessage() {
        return AiMessage.builder()
                .id("assistant-1")
                .conversationId("conversation-1")
                .userId("student-1")
                .role("ASSISTANT")
                .content("""
                        ## Kiểm tra hiểu
                        Câu hỏi: Khi controller trả về home, Spring làm gì?
                        A. Trả view trực tiếp
                        B. Gọi ViewResolver
                        C. Trả lỗi 404
                        Đáp án: B
                        Giải thích: Spring phân giải tên view.
                        """)
                .build();
    }
}
