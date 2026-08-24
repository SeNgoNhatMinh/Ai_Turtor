package com.ragapi.controller;

import com.ragapi.dto.CreateQuestionEscalationRequest;
import com.ragapi.dto.MentorAnswerRequest;
import com.ragapi.dto.MentorEscalationCancelRequest;
import com.ragapi.dto.MentorEscalationOfferResponse;
import com.ragapi.dto.MentorSelectionRequest;
import com.ragapi.dto.MentorSelectionResponse;
import com.ragapi.entity.QuestionEscalation;
import com.ragapi.service.ChatService;
import com.ragapi.service.HumanLearningService;
import com.ragapi.service.MentorEscalationService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.AllArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

import static com.ragapi.util.ValidationUtils.DEFAULT_TEXT_MAX_LENGTH;
import static com.ragapi.util.ValidationUtils.SHORT_TEXT_MAX_LENGTH;
import static com.ragapi.util.ValidationUtils.optionalMaxLength;
import static com.ragapi.util.ValidationUtils.requireMaxLength;
import static com.ragapi.util.ValidationUtils.requireText;

@Slf4j
@RestController
@RequestMapping("/api/tutor/escalations")
@AllArgsConstructor
@Tag(name = "Escalations", description = "Teacher help workflow APIs")
public class EscalationController {

    private final MentorEscalationService mentorEscalationService;
    private final HumanLearningService humanLearningService;
    private final ChatService chatService;

    @PostMapping
    @Operation(summary = "Create a question escalation from n8n AI Harness")
    public ResponseEntity<?> createQuestionEscalation(
            @RequestBody CreateQuestionEscalationRequest request,
            Authentication authentication
    ) {
        try {
            if (request == null) {
                return ResponseEntity.badRequest().body(Map.of("error", "request body is required"));
            }
            String studentId = requireText(request.getStudentId(), "studentId");
            requireSelfOrAdmin(authentication, studentId);
            String courseId = requireText(request.getCourseId(), "courseId");
            String question = requireMaxLength(request.getQuestion(), "question", DEFAULT_TEXT_MAX_LENGTH);
            String studentEmail = optionalMaxLength(request.getStudentEmail(), "studentEmail", SHORT_TEXT_MAX_LENGTH);
            String studentName = optionalMaxLength(request.getStudentName(), "studentName", SHORT_TEXT_MAX_LENGTH);

            String aiResponse = request.getAiResponse() != null && !request.getAiResponse().isBlank()
                    ? requireMaxLength(request.getAiResponse(), "aiResponse", DEFAULT_TEXT_MAX_LENGTH)
                    : "AI Tutor is not confident enough. Escalated by n8n AI Harness.";
            if (request.getReason() != null && !request.getReason().isBlank()) {
                aiResponse = aiResponse + " Reason: " + request.getReason();
            }

            QuestionEscalation escalation = mentorEscalationService.createQuestionEscalation(
                    studentId,
                    studentEmail != null ? studentEmail : "student@example.com",
                    studentName != null ? studentName : studentId,
                    question,
                    aiResponse,
                    courseId,
                    request.getClassId(),
                    request.getConversationId()
            );

            return ResponseEntity.ok(Map.of(
                    "questionEscalationId", escalation.getId(),
                    "status", escalation.getStatus(),
                    "studentId", escalation.getUserId(),
                    "courseId", escalation.getCourseId() == null ? "" : escalation.getCourseId(),
                    "classId", escalation.getClassId() == null ? "" : escalation.getClassId(),
                    "message", "Question escalation created"
            ));
        } catch (SecurityException e) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("error", e.getMessage()));
        } catch (Exception e) {
            log.error("Error creating question escalation", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", e.getMessage()));
        }
    }

    @PostMapping("/offer")
    @Operation(summary = "Offer teacher or mentor help for a question escalation")
    public ResponseEntity<?> offerMentorHelp(
            @RequestParam String questionEscalationId,
            Authentication authentication
    ) {
        try {
            MentorEscalationOfferResponse response = mentorEscalationService.offerMentorHelp(
                    requireText(questionEscalationId, "questionEscalationId"),
                    authenticatedUserId(authentication)
            );
            if (response == null) {
                return ResponseEntity.status(HttpStatus.NOT_FOUND)
                        .body(Map.of("error", "Question escalation not found: " + questionEscalationId));
            }
            return ResponseEntity.ok(response);
        } catch (SecurityException e) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("error", e.getMessage()));
        } catch (Exception e) {
            log.error("Error offering teacher help", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", e.getMessage()));
        }
    }

    @PostMapping("/select")
    @Operation(summary = "Select a teacher or mentor and create a chat room")
    public ResponseEntity<?> selectMentor(
            @RequestBody MentorSelectionRequest request,
            Authentication authentication
    ) {
        try {
            String userId = authenticatedUserId(authentication);
            requireSelfOrAdmin(authentication, requireText(request.getUserId(), "userId"));
            MentorSelectionResponse response = mentorEscalationService.selectMentor(
                    requireText(request.getQuestionEscalationId(), "questionEscalationId"),
                    userId,
                    requireText(request.getSelectedMentorId(), "selectedMentorId")
            );
            return ResponseEntity.ok(response);
        } catch (SecurityException e) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("error", e.getMessage()));
        } catch (Exception e) {
            log.error("Error selecting teacher or mentor", e);
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(Map.of("error", e.getMessage()));
        }
    }

    @PostMapping("/cancel")
    @Operation(summary = "Cancel teacher help offer")
    public ResponseEntity<?> cancelMentorHelp(
            @RequestBody MentorEscalationCancelRequest request,
            Authentication authentication
    ) {
        try {
            String userId = authenticatedUserId(authentication);
            requireSelfOrAdmin(authentication, requireText(request.getUserId(), "userId"));
            mentorEscalationService.cancelMentorHelpOffer(
                    requireText(request.getQuestionEscalationId(), "questionEscalationId"),
                    userId,
                    optionalMaxLength(request.getReason(), "reason", DEFAULT_TEXT_MAX_LENGTH)
            );

            return ResponseEntity.ok(Map.of(
                    "status", "SUCCESS",
                    "message", "Teacher help offer cancelled"
            ));
        } catch (SecurityException e) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("error", e.getMessage()));
        } catch (Exception e) {
            log.error("Error cancelling teacher help", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", e.getMessage()));
        }
    }

    @GetMapping("/history")
    @Operation(summary = "Get escalation history for a student")
    public ResponseEntity<?> getMentorEscalationHistory(
            @RequestParam String userId,
            Authentication authentication
    ) {
        try {
            requireSelfOrAdmin(authentication, requireText(userId, "userId"));
            var escalations = mentorEscalationService.getUserMentorEscalationHistory(requireText(userId, "userId"));
            return ResponseEntity.ok(Map.of(
                    "userId", requireText(userId, "userId"),
                    "escalations", escalations,
                    "count", escalations.size()
            ));
        } catch (SecurityException e) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("error", e.getMessage()));
        } catch (Exception e) {
            log.error("Error fetching escalation history", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", e.getMessage()));
        }
    }

    @GetMapping("/{id}")
    @Operation(summary = "Get escalation detail for student/mentor status tracking")
    public ResponseEntity<?> getEscalationDetail(@PathVariable String id, Authentication authentication) {
        try {
            return ResponseEntity.ok(humanLearningService.getEscalationDetail(
                    id,
                    authenticatedUserId(authentication),
                    authenticatedRole(authentication)
            ));
        } catch (SecurityException e) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(Map.of("error", e.getMessage()));
        } catch (Exception e) {
            log.error("Error fetching escalation detail", e);
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(Map.of("error", e.getMessage()));
        }
    }

    @DeleteMapping("/{id}/teacher-inbox")
    @Operation(summary = "Hide an escalation from the assigned teacher inbox without deleting student history")
    public ResponseEntity<?> hideFromTeacherInbox(
            @PathVariable String id,
            Authentication authentication
    ) {
        try {
            humanLearningService.hideEscalationFromTeacherInbox(id, authenticatedUserId(authentication));
            return ResponseEntity.ok(Map.of(
                    "questionEscalationId", id,
                    "hiddenFromTeacherInbox", true,
                    "studentHistoryPreserved", true,
                    "message", "Escalation hidden from teacher inbox"
            ));
        } catch (SecurityException e) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("error", e.getMessage()));
        } catch (Exception e) {
            log.error("Error hiding escalation from teacher inbox", e);
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("error", e.getMessage()));
        }
    }

    @PostMapping("/{id}/answer")
    @Operation(summary = "Teacher answers an escalated question and creates a pending knowledge candidate")
    public ResponseEntity<?> answerEscalation(
            @PathVariable String id,
            @RequestBody MentorAnswerRequest request,
            Authentication authentication
    ) {
        try {
            request.setTeacherId(authentication.getName());
            Map<String, Object> result = humanLearningService.answerEscalation(id, request);
            Object chatRoomId = result.get("chatRoomId");
            if (chatRoomId instanceof String roomId && !roomId.isBlank()) {
                try {
                    var delivered = chatService.deliverTeacherAnswerToChat(
                            roomId,
                            request.getTeacherId(),
                            request.getTeacherName(),
                            request.getAnswer(),
                            authenticatedRole(authentication)
                    );
                    result.put("chatDelivered", delivered != null);
                    if (delivered != null) {
                        result.put("chatMessageId", delivered.getMessageId());
                    }
                } catch (Exception chatError) {
                    log.warn("Could not deliver teacher answer to chat room {}: {}", roomId, chatError.getMessage());
                    result.put("chatDelivered", false);
                }
            }
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            log.error("Error answering escalation", e);
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(Map.of("error", e.getMessage()));
        }
    }

    @PostMapping("/{id}/knowledge-candidate")
    @Operation(summary = "Create a Knowledge Candidate after the assigned teacher has answered or closed chat")
    public ResponseEntity<?> createKnowledgeCandidateAfterAnswer(
            @PathVariable String id,
            @RequestBody MentorAnswerRequest request,
            Authentication authentication
    ) {
        try {
            request.setTeacherId(authentication.getName());
            request.setCreateKnowledgeCandidate(true);
            return ResponseEntity.ok(
                    humanLearningService.createKnowledgeCandidateAfterAnswer(id, request));
        } catch (Exception e) {
            log.error("Error creating post-answer knowledge candidate", e);
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(Map.of("error", e.getMessage()));
        }
    }

    private String authenticatedUserId(Authentication authentication) {
        if (authentication == null || authentication.getName() == null) {
            throw new SecurityException("Authentication is required");
        }
        return authentication.getName();
    }

    private String authenticatedRole(Authentication authentication) {
        if (authentication == null) {
            return "";
        }
        return authentication.getAuthorities().stream()
                .map(authority -> authority.getAuthority())
                .filter(authority -> authority != null && authority.startsWith("ROLE_"))
                .map(authority -> authority.substring("ROLE_".length()))
                .findFirst()
                .orElse("");
    }

    private void requireSelfOrAdmin(Authentication authentication, String claimedUserId) {
        String authenticatedId = authenticatedUserId(authentication);
        if (!"ADMIN".equalsIgnoreCase(authenticatedRole(authentication))
                && !authenticatedId.equals(claimedUserId)) {
            throw new SecurityException("Requester cannot access another student's escalation");
        }
    }
}
