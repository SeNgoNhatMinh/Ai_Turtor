package com.ragapi.service;

import com.ragapi.dto.ChatClosureResponse;
import com.ragapi.dto.ChatHistoryResponse;
import com.ragapi.dto.ChatMessageInfo;
import com.ragapi.dto.ChatMessageRequest;
import com.ragapi.dto.ChatMessageResponse;
import com.ragapi.dto.ChatRoomDetailResponse;
import com.ragapi.dto.MentorAnswerRequest;
import com.ragapi.entity.ChatMessage;
import com.ragapi.entity.ChatRoom;
import com.ragapi.entity.KnowledgeCandidate;
import com.ragapi.entity.Mentor;
import com.ragapi.repository.ChatMessageRepository;
import com.ragapi.repository.ChatRoomRepository;
import com.ragapi.repository.MentorRepository;
import com.ragapi.repository.QuestionEscalationRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class ChatService {

    private final ChatRoomRepository chatRoomRepository;
    private final ChatMessageRepository chatMessageRepository;
    private final QuestionEscalationRepository questionEscalationRepository;
    private final MentorRepository mentorRepository;
    private final HumanLearningService humanLearningService;

    public ChatMessageResponse sendMessage(ChatMessageRequest request, String requesterId, String requesterRole) {
        validateMessageRequest(request);
        ChatRoom room = requireAccessibleRoom(request.getChatRoomId(), requesterId, requesterRole);
        if (!"ACTIVE".equalsIgnoreCase(room.getStatus())) {
            throw new IllegalArgumentException("CHAT_ROOM_CLOSED: Cannot send messages to a closed chat room");
        }
        if (!requesterId.equals(request.getSenderId())) {
            throw new SecurityException("senderId must match the authenticated user");
        }
        String expectedSenderRole = expectedChatSenderRole(requesterRole);
        if (!expectedSenderRole.equalsIgnoreCase(request.getSenderRole())) {
            throw new SecurityException("senderRole does not match the authenticated account role");
        }

        ChatMessage message = ChatMessage.builder()
                .id(UUID.randomUUID().toString())
                .chatRoomId(request.getChatRoomId())
                .senderId(requesterId)
                .senderName(request.getSenderName())
                .senderEmail(null)
                .senderRole(expectedSenderRole)
                .content(request.getContent().trim())
                .messageType(request.getMessageType() == null ? "TEXT" : request.getMessageType())
                .attachmentUrl(request.getAttachmentUrl())
                .attachmentName(request.getAttachmentName())
                .status("SENT")
                .sentAt(LocalDateTime.now())
                .charCount(request.getContent().trim().length())
                .hasAISuggestion(false)
                .build();
        message = chatMessageRepository.save(message);

        room.setMessageCount(value(room.getMessageCount()) + 1);
        room.setLastMessageAt(LocalDateTime.now());
        if ("STUDENT".equals(expectedSenderRole)) {
            room.setUserMessageCount(value(room.getUserMessageCount()) + 1);
        } else {
            room.setMentorMessageCount(value(room.getMentorMessageCount()) + 1);
        }
        room.setIsUnread(true);
        chatRoomRepository.save(room);
        log.info("Message sent in chat room {} by {} ({})", room.getId(), requesterId, expectedSenderRole);
        return mapMessageToResponse(message);
    }

    public ChatMessageResponse sendAnswerAndCreateKnowledgeCandidate(
            ChatMessageRequest request,
            String requesterId,
            String requesterRole
    ) {
        if (!isTeacher(requesterRole) && !isAdmin(requesterRole)) {
            throw new SecurityException("Only teachers can send an answer and create a knowledge candidate");
        }
        requireAccessibleRoom(request.getChatRoomId(), requesterId, requesterRole);

        MentorAnswerRequest answerRequest = new MentorAnswerRequest();
        answerRequest.setTeacherId(requesterId);
        answerRequest.setTeacherName(request.getSenderName());
        answerRequest.setAnswer(request.getContent());
        answerRequest.setCreateKnowledgeCandidate(true);
        answerRequest.setCandidateType(request.getCandidateType());
        answerRequest.setImageIds(request.getImageIds());

        var candidateResult = humanLearningService.submitTeacherChatAnswerAndCandidate(
                request.getChatRoomId(),
                answerRequest
        );
        ChatMessageResponse sent = sendMessage(request, requesterId, requesterRole);
        applyCandidateResult(sent, candidateResult);
        return sent;
    }

    public ChatMessageResponse deliverTeacherAnswerToChat(
            String chatRoomId,
            String teacherId,
            String teacherName,
            String content,
            String requesterRole
    ) {
        if (blank(chatRoomId) || blank(teacherId) || blank(content)) {
            return null;
        }
        ChatRoom room = chatRoomRepository.findById(chatRoomId).orElse(null);
        if (room == null || !"ACTIVE".equalsIgnoreCase(room.getStatus())) {
            return null;
        }
        ChatMessageRequest request = ChatMessageRequest.builder()
                .chatRoomId(chatRoomId)
                .senderId(teacherId)
                .senderName(teacherName)
                .senderRole("MENTOR")
                .content(content)
                .messageType("TEXT")
                .build();
        return sendMessage(request, teacherId, requesterRole);
    }

    public ChatHistoryResponse getChatHistory(String chatRoomId, int pageNumber, int pageSize,
                                              String requesterId, String requesterRole) {
        requireAccessibleRoom(chatRoomId, requesterId, requesterRole);
        int safePage = Math.max(0, pageNumber);
        int safeSize = Math.min(100, Math.max(1, pageSize));
        Page<ChatMessage> page = chatMessageRepository.findByChatRoomId(
                chatRoomId,
                PageRequest.of(safePage, safeSize, Sort.by("sentAt").descending())
        );
        List<ChatMessageInfo> messages = page.getContent().stream().map(this::mapMessageToInfo).toList();
        return ChatHistoryResponse.builder()
                .chatRoomId(chatRoomId)
                .totalMessageCount((int) page.getTotalElements())
                .pageNumber(safePage)
                .pageSize(safeSize)
                .messages(messages)
                .build();
    }

    public ChatRoomDetailResponse getChatRoomDetail(String chatRoomId, String requesterId, String requesterRole) {
        ChatRoom room = requireAccessibleRoom(chatRoomId, requesterId, requesterRole);
        return ChatRoomDetailResponse.builder()
                .chatRoomId(room.getId())
                .userId(room.getUserId())
                .userName(room.getUserName())
                .mentorId(room.getMentorId())
                .mentorName(room.getMentorName())
                .mentorEmail(room.getMentorEmail())
                .mentorAvatarUrl(getMentorAvatar(room.getMentorId()))
                .originalQuestion(room.getOriginalQuestion())
                .aiResponse(room.getAiResponse())
                .status(room.getStatus())
                .messageCount(room.getMessageCount())
                .createdAt(room.getCreatedAt())
                .lastMessageAt(room.getLastMessageAt())
                .isUnread(room.getIsUnread())
                .build();
    }

    public void markChatAsRead(String chatRoomId, String requesterId, String requesterRole) {
        ChatRoom room = requireAccessibleRoom(chatRoomId, requesterId, requesterRole);
        room.setIsUnread(false);
        chatRoomRepository.save(room);
    }

    public ChatClosureResponse closeChatRoom(String chatRoomId, String requesterId, String requesterRole,
                                             Double userRating, String userFeedback) {
        ChatRoom room = requireAccessibleRoom(chatRoomId, requesterId, requesterRole);
        if ("CLOSED".equalsIgnoreCase(room.getStatus())) {
            throw new IllegalArgumentException("CHAT_ROOM_ALREADY_CLOSED");
        }
        if (userRating != null && (userRating < 1 || userRating > 5)) {
            throw new IllegalArgumentException("userRating must be between 1 and 5");
        }

        room.setStatus("CLOSED");
        room.setClosedAt(LocalDateTime.now());
        room.setFinalRating(userRating);
        chatRoomRepository.save(room);

        var linkedEscalation = questionEscalationRepository.findByChatRoomId(chatRoomId);
        linkedEscalation.ifPresent(escalation -> {
            escalation.setStatus("COMPLETED");
            escalation.setUserSatisfactionRating(userRating);
            escalation.setUserFeedback(userFeedback);
            escalation.setDurationSeconds((int) java.time.temporal.ChronoUnit.SECONDS
                    .between(room.getCreatedAt(), LocalDateTime.now()));
            escalation.setUpdatedAt(LocalDateTime.now());
            questionEscalationRepository.save(escalation);
        });

        mentorRepository.findById(room.getMentorId()).ifPresent(mentor -> {
            mentor.setCurrentActiveChatSessions(Math.max(0, value(mentor.getCurrentActiveChatSessions()) - 1));
            long durationHours = java.time.temporal.ChronoUnit.SECONDS
                    .between(room.getCreatedAt(), LocalDateTime.now()) / 3600;
            mentor.setTotalHoursSpent(value(mentor.getTotalHoursSpent()) + (int) durationHours);
            mentor.setUpdatedAt(LocalDateTime.now());
            mentorRepository.save(mentor);
        });

        boolean canCreateCandidate = isTeacher(requesterRole)
                && linkedEscalation.map(escalation -> !blank(escalation.getCourseId())).orElse(false);

        return ChatClosureResponse.builder()
                .chatRoomId(chatRoomId)
                .status("CLOSED")
                .message(canCreateCandidate
                        ? "Phòng chat đã đóng. Giáo viên có thể tạo kiến thức RAG từ câu trả lời để gửi senior duyệt."
                        : "Phòng chat đã đóng. Cảm ơn bạn đã sử dụng dịch vụ!")
                .closedAt(LocalDateTime.now())
                .questionEscalationId(linkedEscalation.map(escalation -> escalation.getId()).orElse(null))
                .canCreateKnowledgeCandidate(canCreateCandidate)
                .suggestedCandidateType(canCreateCandidate ? "ACADEMIC_KNOWLEDGE" : null)
                .nextAction(canCreateCandidate ? "SHOW_CREATE_KNOWLEDGE_CANDIDATE_BUTTON" : "NONE")
                .build();
    }

    public List<ChatRoom> getUnreadChatRooms(String requesterId, String requesterRole) {
        if (isAdmin(requesterRole)) {
            return chatRoomRepository.findAll().stream().filter(room -> Boolean.TRUE.equals(room.getIsUnread())).toList();
        }
        if (isTeacher(requesterRole)) {
            return chatRoomRepository.findByMentorIdAndIsUnreadTrue(requesterId);
        }
        return chatRoomRepository.findByUserIdAndIsUnreadTrue(requesterId);
    }

    public ChatRoom requireAccessibleRoom(String chatRoomId, String requesterId, String requesterRole) {
        if (chatRoomId == null || chatRoomId.isBlank()) throw new IllegalArgumentException("chatRoomId is required");
        if (requesterId == null || requesterId.isBlank()) throw new SecurityException("Authenticated user is required");
        ChatRoom room = chatRoomRepository.findById(chatRoomId)
                .orElseThrow(() -> new IllegalArgumentException("Chat room not found"));
        if (isAdmin(requesterRole)) return room;
        boolean allowed = isTeacher(requesterRole)
                ? requesterId.equals(room.getMentorId())
                : requesterId.equals(room.getUserId());
        if (!allowed) throw new SecurityException("You are not a participant of this chat room");
        return room;
    }

    private void validateMessageRequest(ChatMessageRequest request) {
        if (request == null) throw new IllegalArgumentException("request body is required");
        if (blank(request.getChatRoomId())) throw new IllegalArgumentException("chatRoomId is required");
        if (blank(request.getSenderId())) throw new IllegalArgumentException("senderId is required");
        if (blank(request.getSenderRole())) throw new IllegalArgumentException("senderRole is required");
        if (blank(request.getContent())) throw new IllegalArgumentException("content is required");
        if (request.getContent().length() > 10000) throw new IllegalArgumentException("content is too long");
    }

    private String expectedChatSenderRole(String role) {
        return isTeacher(role) || isAdmin(role) ? "MENTOR" : "STUDENT";
    }

    private boolean isTeacher(String role) {
        return "TEACHER".equalsIgnoreCase(role) || "SENIOR_MENTOR".equalsIgnoreCase(role);
    }

    private boolean isAdmin(String role) {
        return "ADMIN".equalsIgnoreCase(role);
    }

    private boolean blank(String value) {
        return value == null || value.isBlank();
    }

    private int value(Integer number) {
        return number == null ? 0 : number;
    }

    private void applyCandidateResult(ChatMessageResponse sent, Map<String, Object> result) {
        if (sent == null || result == null) {
            return;
        }
        sent.setQuestionEscalationId(asString(result.get("questionEscalationId")));
        sent.setKnowledgeCandidateCreated(Boolean.TRUE.equals(result.get("knowledgeCandidateCreated")));
        sent.setKnowledgeCandidateAlreadyExists(Boolean.TRUE.equals(result.get("alreadyExists")));
        Object candidate = result.get("knowledgeCandidate");
        if (candidate instanceof KnowledgeCandidate knowledgeCandidate) {
            sent.setKnowledgeCandidateId(knowledgeCandidate.getId());
            sent.setKnowledgeCandidateStatus(knowledgeCandidate.getStatus());
        } else {
            sent.setKnowledgeCandidateId(asString(result.get("candidateId")));
            sent.setKnowledgeCandidateStatus(asString(result.get("candidateStatus")));
        }
        sent.setActionMessage(asString(result.get("message")));
    }

    private String asString(Object value) {
        return value == null ? null : String.valueOf(value);
    }

    private ChatMessageResponse mapMessageToResponse(ChatMessage message) {
        return ChatMessageResponse.builder()
                .messageId(message.getId()).chatRoomId(message.getChatRoomId())
                .senderId(message.getSenderId()).senderName(message.getSenderName())
                .senderRole(message.getSenderRole()).senderAvatarUrl(message.getSenderAvatarUrl())
                .content(message.getContent()).messageType(message.getMessageType())
                .sentAt(message.getSentAt()).status(message.getStatus()).build();
    }

    private ChatMessageInfo mapMessageToInfo(ChatMessage message) {
        return ChatMessageInfo.builder()
                .messageId(message.getId()).senderId(message.getSenderId())
                .senderName(message.getSenderName()).senderRole(message.getSenderRole())
                .senderAvatarUrl(message.getSenderAvatarUrl()).content(message.getContent())
                .messageType(message.getMessageType()).sentAt(message.getSentAt())
                .status(message.getStatus()).attachmentUrl(message.getAttachmentUrl())
                .attachmentName(message.getAttachmentName()).build();
    }

    private String getMentorAvatar(String mentorId) {
        return mentorRepository.findById(mentorId).map(Mentor::getAvatarUrl).orElse(null);
    }
}
