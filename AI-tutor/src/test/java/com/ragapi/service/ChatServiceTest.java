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
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ChatServiceTest {

    @Mock ChatRoomRepository chatRoomRepository;
    @Mock ChatMessageRepository chatMessageRepository;
    @Mock QuestionEscalationRepository escalationRepository;
    @Mock MentorRepository mentorRepository;

    private ChatService service;
    private ChatRoom activeRoom;

    @BeforeEach
    void setUp() {
        service = new ChatService(chatRoomRepository, chatMessageRepository, escalationRepository, mentorRepository);
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
