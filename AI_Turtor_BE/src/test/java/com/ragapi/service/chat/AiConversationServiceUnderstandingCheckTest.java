package com.ragapi.service.chat;
import com.ragapi.service.notification.RealtimeEventService;
import com.ragapi.harness.curriculum.CourseIndexedChunkLoader;
import com.ragapi.harness.curriculum.CourseCurriculumOverviewService;
import com.ragapi.harness.review.AdaptiveLearningReviewService;

import com.ragapi.harness.HarnessCollections;
import com.ragapi.dto.RagQueryIntent;
import com.ragapi.dto.RagSourceEvidence;
import com.ragapi.dto.UnderstandingCheckResultResponse;
import com.ragapi.entity.AiConversation;
import com.ragapi.entity.AiMessage;
import com.ragapi.repository.AiConversationRepository;
import com.ragapi.repository.AiMessageRepository;
import com.ragapi.repository.ClassSectionRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.List;
import java.util.Optional;

import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class AiConversationServiceUnderstandingCheckTest {

    private AiConversationRepository conversationRepository;
    private AiMessageRepository messageRepository;
    private CourseCurriculumOverviewService curriculumOverviewService;
    private MongoTemplate mongoTemplate;
    private CourseIndexedChunkLoader indexedChunkLoader;
    private AiConversationService service;

    @BeforeEach
    void setUp() {
        conversationRepository = mock(AiConversationRepository.class);
        messageRepository = mock(AiMessageRepository.class);
        curriculumOverviewService = mock(CourseCurriculumOverviewService.class);
        mongoTemplate = mock(MongoTemplate.class);
        indexedChunkLoader = mock(CourseIndexedChunkLoader.class);
        service = new AiConversationService(
                conversationRepository,
                messageRepository,
                curriculumOverviewService,
                mock(AdaptiveLearningReviewService.class),
                mock(ClassSectionRepository.class),
                mock(RealtimeEventService.class),
                mongoTemplate,
                indexedChunkLoader
        );
        when(conversationRepository.findByIdAndUserId("conversation-1", "student-1"))
                .thenReturn(Optional.of(AiConversation.builder()
                        .id("conversation-1")
                        .userId("student-1")
                        .build()));
        when(messageRepository.save(any(AiMessage.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));
    }

    @Test
    void deletingConversationDetachesPreservedLearningRecords() {
        service.deleteConversation("conversation-1", "student-1");

        verify(messageRepository).deleteByConversationId("conversation-1");
        verify(conversationRepository).deleteByIdAndUserId("conversation-1", "student-1");
        verify(mongoTemplate).updateMulti(any(Query.class), any(Update.class), eq(HarnessCollections.HANDOFFS));
        verify(mongoTemplate).updateMulti(any(Query.class), any(Update.class), eq(HarnessCollections.ANSWER_REVIEWS));
        verify(mongoTemplate).updateMulti(any(Query.class), any(Update.class), eq("harness_logs"));
        verify(mongoTemplate).updateMulti(any(Query.class), any(Update.class), eq(HarnessCollections.SESSIONS));
        verify(mongoTemplate).updateMulti(any(Query.class), any(Update.class), eq(HarnessCollections.SESSION_SUMMARIES));
    }

    @Test
    void openingWelcomeIsRefreshedToCurrentCurriculumOnRead() {
        AiConversation conversation = AiConversation.builder()
                .id("conversation-1").userId("student-1").courseId("CEA201").build();
        when(conversationRepository.findByIdAndUserId("conversation-1", "student-1"))
                .thenReturn(Optional.of(conversation));
        AiMessage staleOpening = AiMessage.builder()
                .id("opening-1").conversationId("conversation-1").userId("student-1")
                .role("ASSISTANT").proactive(true)
                .content("Lời chào cũ: đoạn syllabus thô, thiếu mục chủ đề")
                .build();
        when(messageRepository.findByConversationIdOrderByCreatedAtAsc("conversation-1"))
                .thenReturn(List.of(staleOpening));
        when(curriculumOverviewService.newChatWelcomeMarkdown("CEA201")).thenReturn("Lời chào mới theo curriculum");
        when(messageRepository.findByConversationId(eq("conversation-1"), any(Pageable.class)))
                .thenReturn(new PageImpl<>(List.of(staleOpening)));

        service.getMessages("conversation-1", "student-1", 0, 20);

        assertEquals("Lời chào mới theo curriculum", staleOpening.getContent());
        verify(messageRepository).save(staleOpening);
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
    void recordsEachQuizItemSeparately() {
        AiMessage message = AiMessage.builder()
                .id("assistant-1")
                .conversationId("conversation-1")
                .userId("student-1")
                .role("ASSISTANT")
                .content("""
                        ## Kiểm tra hiểu

                        Q1.
                        Câu một là gì?
                        A. Một
                        B. Hai
                        Đáp án đúng: B
                        Giải thích: Vì hai.

                        Q2.
                        Câu hai là gì?
                        A. Một
                        B. Hai
                        Đáp án đúng: A
                        Giải thích: Vì một.
                        """)
                .build();
        when(messageRepository.findByIdAndConversationIdAndUserId(
                "assistant-1", "conversation-1", "student-1"))
                .thenReturn(Optional.of(message));

        UnderstandingCheckResultResponse second = service.recordUnderstandingCheck(
                "conversation-1", "assistant-1", "student-1", "B", 1);

        assertEquals(1, second.getQuizIndex());
        assertEquals("INCORRECT", second.getStatus());
        assertEquals("B", second.getSelectedKey());
        // Item 2 is stored on its own attempt; item 1 stays unanswered and the
        // legacy singular fields (item 1) are untouched.
        assertEquals(2, message.getUnderstandingCheckAttempts().size());
        assertEquals(null, message.getUnderstandingCheckAttempts().get(0).getSelectedKey());
        assertEquals("B", message.getUnderstandingCheckAttempts().get(1).getSelectedKey());
        assertEquals(false, message.getUnderstandingCheckAttempts().get(1).getCorrect());
        assertEquals(null, message.getUnderstandingSelectedKey());
    }

    @Test
    void buildsRemediationIntentFromTheOriginatingEvidence() {
        AiMessage message = understandingMessage();
        message.setUnderstandingAttemptId("attempt-1");
        // A graded wrong answer always records the chosen option (B is correct).
        message.setUnderstandingSelectedKey("A");
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

    @Test
    void openingACourseChatLoadsThatCoursesStoredExcerpts() {
        when(conversationRepository.findByUserIdAndCourseId(eq("student-1"), eq("PRJ301"), any(Pageable.class)))
                .thenReturn(new PageImpl<>(List.of()));

        service.listConversations("student-1", "PRJ301", 0, 20);
        service.listConversations("student-1", "PRJ301", 0, 20);

        verify(indexedChunkLoader, org.mockito.Mockito.times(2)).loadCourse("PRJ301");
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
