package com.ragapi.service;

import com.ragapi.dto.ChatMessageRequest;
import com.ragapi.entity.ChatMessage;
import com.ragapi.entity.ChatRoom;
import com.ragapi.repository.ChatMessageRepository;
import com.ragapi.repository.ChatRoomRepository;
import com.ragapi.repository.MentorRepository;
import com.ragapi.repository.QuestionEscalationRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDateTime;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ChatServiceTest {

    @Mock ChatRoomRepository chatRoomRepository;
    @Mock ChatMessageRepository chatMessageRepository;
    @Mock QuestionEscalationRepository escalationRepository;
    @Mock MentorRepository mentorRepository;
    @Mock HumanLearningService humanLearningService;

    private ChatService service;
    private ChatRoom activeRoom;

    @BeforeEach
    void setUp() {
        service = new ChatService(
                chatRoomRepository,
                chatMessageRepository,
                escalationRepository,
                mentorRepository,
                humanLearningService
        );
        activeRoom = ChatRoom.builder()
                .id("ROOM-1")
                .userId("STUDENT-1")
                .mentorId("TEACHER-1")
                .status("ACTIVE")
                .messageCount(0)
                .userMessageCount(0)
                .mentorMessageCount(0)
                .createdAt(LocalDateTime.now())
                .build();
    }

    @Test
    void outsiderCannotReadRoom() {
        when(chatRoomRepository.findById("ROOM-1")).thenReturn(Optional.of(activeRoom));
        assertThrows(SecurityException.class,
                () -> service.requireAccessibleRoom("ROOM-1", "STUDENT-OTHER", "STUDENT"));
    }

    @Test
    void senderIdMustMatchJwt() {
        when(chatRoomRepository.findById("ROOM-1")).thenReturn(Optional.of(activeRoom));
        ChatMessageRequest request = request("TEACHER-1", "STUDENT");
        assertThrows(SecurityException.class,
                () -> service.sendMessage(request, "STUDENT-1", "STUDENT"));
        verify(chatMessageRepository, never()).save(any());
    }

    @Test
    void senderRoleMustMatchJwtRole() {
        when(chatRoomRepository.findById("ROOM-1")).thenReturn(Optional.of(activeRoom));
        ChatMessageRequest request = request("STUDENT-1", "MENTOR");
        assertThrows(SecurityException.class,
                () -> service.sendMessage(request, "STUDENT-1", "STUDENT"));
    }

    @Test
    void closedRoomRejectsNewMessages() {
        activeRoom.setStatus("CLOSED");
        when(chatRoomRepository.findById("ROOM-1")).thenReturn(Optional.of(activeRoom));
        assertThrows(IllegalArgumentException.class,
                () -> service.sendMessage(request("STUDENT-1", "STUDENT"), "STUDENT-1", "STUDENT"));
    }

    @Test
    void validStudentMessageIsSaved() {
        when(chatRoomRepository.findById("ROOM-1")).thenReturn(Optional.of(activeRoom));
        when(chatMessageRepository.save(any(ChatMessage.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(chatRoomRepository.save(any(ChatRoom.class))).thenAnswer(invocation -> invocation.getArgument(0));

        var response = service.sendMessage(request("STUDENT-1", "STUDENT"), "STUDENT-1", "STUDENT");

        assertEquals("ROOM-1", response.getChatRoomId());
        assertEquals("STUDENT-1", response.getSenderId());
        assertEquals("STUDENT", response.getSenderRole());
        assertEquals(1, activeRoom.getMessageCount());
        verify(chatMessageRepository).save(any(ChatMessage.class));
        verify(chatRoomRepository).save(activeRoom);
    }

    @Test
    void studentCannotSendAnswerAndCreateKnowledgeCandidate() {
        ChatMessageRequest request = request("STUDENT-1", "STUDENT");
        assertThrows(SecurityException.class,
                () -> service.sendAnswerAndCreateKnowledgeCandidate(request, "STUDENT-1", "STUDENT"));
        verify(humanLearningService, never()).submitTeacherChatAnswerAndCandidate(any(), any());
        verify(chatMessageRepository, never()).save(any());
    }

    @Test
    void teacherSendAnswerAndIndexSavesChatAndCreatesCandidate() {
        when(chatRoomRepository.findById("ROOM-1")).thenReturn(Optional.of(activeRoom));
        when(chatMessageRepository.save(any(ChatMessage.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(chatRoomRepository.save(any(ChatRoom.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(humanLearningService.submitTeacherChatAnswerAndCandidate(eq("ROOM-1"), any()))
                .thenReturn(java.util.Map.of(
                        "questionEscalationId", "ESC-1",
                        "knowledgeCandidateCreated", true,
                        "alreadyExists", false,
                        "candidateId", "CAND-1",
                        "candidateStatus", "PENDING_SENIOR_REVIEW",
                        "message", "Teacher answer saved."
                ));

        var response = service.sendAnswerAndCreateKnowledgeCandidate(
                request("TEACHER-1", "MENTOR"), "TEACHER-1", "TEACHER");

        assertEquals("ROOM-1", response.getChatRoomId());
        assertEquals("MENTOR", response.getSenderRole());
        assertTrue(response.getKnowledgeCandidateCreated());
        assertEquals("CAND-1", response.getKnowledgeCandidateId());
        verify(humanLearningService).submitTeacherChatAnswerAndCandidate(eq("ROOM-1"), any());
        verify(chatMessageRepository).save(any(ChatMessage.class));
    }

    @Test
    void assignedSeniorMentorCanAccessTeacherRoom() {
        when(chatRoomRepository.findById("ROOM-1")).thenReturn(Optional.of(activeRoom));
        ChatRoom room = service.requireAccessibleRoom("ROOM-1", "TEACHER-1", "SENIOR_MENTOR");
        assertEquals("ROOM-1", room.getId());
    }

    private ChatMessageRequest request(String senderId, String senderRole) {
        return ChatMessageRequest.builder()
                .chatRoomId("ROOM-1")
                .senderId(senderId)
                .senderName("Sender")
                .senderRole(senderRole)
                .content("Hello")
                .messageType("TEXT")
                .build();
    }
}
