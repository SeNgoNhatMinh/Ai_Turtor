package com.ragapi.controller;

import com.ragapi.dto.ChatClosureRequest;
import com.ragapi.dto.ChatMarkAsReadRequest;
import com.ragapi.dto.ChatMessageRequest;
import com.ragapi.service.ChatService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@Slf4j
@RestController
@RequestMapping("/api/chat")
@RequiredArgsConstructor
public class ChatController {

    private final ChatService chatService;

    @PostMapping("/send")
    public ResponseEntity<?> sendMessage(@RequestBody ChatMessageRequest request, Authentication auth) {
        try {
            return ResponseEntity.ok(chatService.sendMessage(request, userId(auth), role(auth)));
        } catch (Exception e) {
            return error("sending message", e);
        }
    }

    @GetMapping("/history")
    public ResponseEntity<?> getChatHistory(@RequestParam String chatRoomId,
                                            @RequestParam(defaultValue = "0") int page,
                                            @RequestParam(defaultValue = "50") int size,
                                            Authentication auth) {
        try {
            return ResponseEntity.ok(chatService.getChatHistory(chatRoomId, page, size, userId(auth), role(auth)));
        } catch (Exception e) {
            return error("fetching chat history", e);
        }
    }

    @GetMapping("/detail")
    public ResponseEntity<?> getChatRoomDetail(@RequestParam String chatRoomId, Authentication auth) {
        try {
            return ResponseEntity.ok(chatService.getChatRoomDetail(chatRoomId, userId(auth), role(auth)));
        } catch (Exception e) {
            return error("fetching chat room detail", e);
        }
    }

    @PostMapping("/mark-read")
    public ResponseEntity<?> markChatAsRead(@RequestBody ChatMarkAsReadRequest request, Authentication auth) {
        try {
            chatService.markChatAsRead(request.getChatRoomId(), userId(auth), role(auth));
            return ResponseEntity.ok(Map.of("status", "SUCCESS", "message", "Chat đã được đánh dấu là đã đọc"));
        } catch (Exception e) {
            return error("marking chat as read", e);
        }
    }

    @PostMapping("/close")
    public ResponseEntity<?> closeChatRoom(@RequestBody ChatClosureRequest request, Authentication auth) {
        try {
            return ResponseEntity.ok(chatService.closeChatRoom(
                    request.getChatRoomId(), userId(auth), role(auth),
                    request.getUserRating(), request.getUserFeedback()));
        } catch (Exception e) {
            return error("closing chat room", e);
        }
    }

    @GetMapping("/unread")
    public ResponseEntity<?> getUnreadChats(Authentication auth) {
        try {
            String requesterId = userId(auth);
            String requesterRole = role(auth);
            var rooms = chatService.getUnreadChatRooms(requesterId, requesterRole);
            return ResponseEntity.ok(Map.of(
                    "participantId", requesterId,
                    "role", requesterRole,
                    "unreadCount", rooms.size(),
                    "chatRooms", rooms));
        } catch (Exception e) {
            return error("fetching unread chats", e);
        }
    }

    private String userId(Authentication auth) {
        if (auth == null || auth.getName() == null) throw new SecurityException("Authentication is required");
        return auth.getName();
    }

    private String role(Authentication auth) {
        if (auth == null || auth.getAuthorities().isEmpty()) throw new SecurityException("Authentication role is required");
        return auth.getAuthorities().iterator().next().getAuthority().replaceFirst("^ROLE_", "");
    }

    private ResponseEntity<?> error(String action, Exception e) {
        log.error("Error {}", action, e);
        HttpStatus status = e instanceof SecurityException ? HttpStatus.FORBIDDEN
                : e instanceof IllegalArgumentException ? HttpStatus.BAD_REQUEST
                : HttpStatus.INTERNAL_SERVER_ERROR;
        return ResponseEntity.status(status).body(Map.of("error", e.getMessage() == null ? "Chat error" : e.getMessage()));
    }
}
