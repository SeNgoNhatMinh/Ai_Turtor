package com.ragapi.controller;

import com.ragapi.dto.AiConversationHistoryResponse;
import com.ragapi.dto.AiConversationListResponse;
import com.ragapi.dto.AiConversationSummary;
import com.ragapi.dto.RenameAiConversationRequest;
import com.ragapi.service.AiConversationService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@Slf4j
@RestController
@RequiredArgsConstructor
@RequestMapping("/api/ai/conversations")
@Tag(name = "AI Conversation History", description = "Manage AI tutor conversation history, pinned messages, and search")
public class AiConversationController {

    private final AiConversationService aiConversationService;

    @GetMapping
    @Operation(summary = "List AI tutor conversations")
    public ResponseEntity<?> listConversations(
            @RequestParam String userId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "50") int size,
            @RequestParam(value = "courseId", required = false) String courseId
    ) {
        try {
            AiConversationListResponse response = aiConversationService.listConversations(userId, courseId, page, size);
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            log.error("Error listing AI conversations", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(Map.of("error", e.getMessage()));
        }
    }

    @PostMapping
    @Operation(summary = "Create a new AI tutor conversation")
    public ResponseEntity<?> createConversation(
            @RequestParam String userId,
            @RequestParam(value = "courseId", required = false) String courseId,
            @RequestParam(value = "classId", required = false) String classId
    ) {
        try {
            AiConversationSummary summary = aiConversationService.createConversation(userId, courseId, classId);
            return ResponseEntity.ok(summary);
        } catch (Exception e) {
            log.error("Error creating AI conversation", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(Map.of("error", e.getMessage()));
        }
    }

    @GetMapping("/search")
    @Operation(summary = "Search messages across a student's AI conversations")
    public ResponseEntity<?> searchMessages(
            @RequestParam String userId,
            @RequestParam String keyword,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(value = "courseId", required = false) String courseId
    ) {
        try {
            return ResponseEntity.ok(aiConversationService.searchMessages(userId, keyword, courseId, page, size));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        } catch (Exception e) {
            log.error("Error searching AI messages", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(Map.of("error", e.getMessage()));
        }
    }

    @GetMapping("/{conversationId}/messages")
    @Operation(summary = "Get messages in an AI tutor conversation")
    public ResponseEntity<?> getMessages(
            @PathVariable String conversationId,
            @RequestParam String userId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "100") int size
    ) {
        try {
            AiConversationHistoryResponse response = aiConversationService.getMessages(conversationId, userId, page, size);
            return ResponseEntity.ok(response);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", e.getMessage()));
        } catch (Exception e) {
            log.error("Error fetching AI conversation messages", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(Map.of("error", e.getMessage()));
        }
    }

    @GetMapping("/{conversationId}/pinned-messages")
    @Operation(summary = "List pinned messages in an AI tutor conversation")
    public ResponseEntity<?> listPinnedMessages(
            @PathVariable String conversationId,
            @RequestParam String userId
    ) {
        try {
            return ResponseEntity.ok(Map.of(
                    "conversationId", conversationId,
                    "messages", aiConversationService.listPinnedMessages(conversationId, userId)
            ));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", e.getMessage()));
        } catch (Exception e) {
            log.error("Error listing pinned messages", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(Map.of("error", e.getMessage()));
        }
    }

    @PatchMapping("/{conversationId}/messages/{messageId}/pin")
    @Operation(summary = "Pin a message inside an AI tutor conversation")
    public ResponseEntity<?> pinMessage(
            @PathVariable String conversationId,
            @PathVariable String messageId,
            @RequestParam String userId
    ) {
        try {
            return ResponseEntity.ok(aiConversationService.pinMessage(conversationId, messageId, userId));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", e.getMessage()));
        } catch (Exception e) {
            log.error("Error pinning message", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(Map.of("error", e.getMessage()));
        }
    }

    @DeleteMapping("/{conversationId}/messages/{messageId}/pin")
    @Operation(summary = "Unpin a message inside an AI tutor conversation")
    public ResponseEntity<?> unpinMessage(
            @PathVariable String conversationId,
            @PathVariable String messageId,
            @RequestParam String userId
    ) {
        try {
            return ResponseEntity.ok(aiConversationService.unpinMessage(conversationId, messageId, userId));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", e.getMessage()));
        } catch (Exception e) {
            log.error("Error unpinning message", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(Map.of("error", e.getMessage()));
        }
    }

    @PatchMapping("/{conversationId}")
    @Operation(summary = "Rename an AI tutor conversation")
    public ResponseEntity<?> renameConversation(
            @PathVariable String conversationId,
            @RequestBody RenameAiConversationRequest request
    ) {
        try {
            AiConversationSummary summary = aiConversationService.renameConversation(
                    conversationId, request.getUserId(), request.getTitle()
            );
            return ResponseEntity.ok(summary);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        } catch (Exception e) {
            log.error("Error renaming AI conversation", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(Map.of("error", e.getMessage()));
        }
    }

    @DeleteMapping("/{conversationId}")
    @Operation(summary = "Delete an AI tutor conversation")
    public ResponseEntity<?> deleteConversation(
            @PathVariable String conversationId,
            @RequestParam String userId
    ) {
        try {
            aiConversationService.deleteConversation(conversationId, userId);
            return ResponseEntity.ok(Map.of("status", "SUCCESS", "message", "Đã xóa cuộc trò chuyện"));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", e.getMessage()));
        } catch (Exception e) {
            log.error("Error deleting AI conversation", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(Map.of("error", e.getMessage()));
        }
    }
}
