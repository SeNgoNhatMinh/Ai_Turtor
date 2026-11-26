package com.ragapi.controller;

import com.ragapi.util.ErrorStatus;
import static com.ragapi.util.ValidationUtils.DEFAULT_TEXT_MAX_LENGTH;
import static com.ragapi.util.ValidationUtils.requireMaxLength;
import static com.ragapi.util.ValidationUtils.requireText;

import com.ragapi.dto.AiQueryResponse;
import com.ragapi.dto.CourseRagAnswer;
import com.ragapi.dto.GenerateQuizRequest;
import com.ragapi.dto.LearnSuggestionRequest;
import com.ragapi.dto.SuggestionRequest;
import com.ragapi.dto.SuggestionResponse;
import com.ragapi.dto.SubmitQuizRequest;
import com.ragapi.service.chat.AiConversationService;
import com.ragapi.harness.gateway.CourseAnswerGateway;
import com.ragapi.harness.improve.ImproveSuggestionService;
import com.ragapi.harness.quiz.QuizService;
import com.ragapi.harness.memory.StudentCourseMemoryService;
import com.ragapi.harness.entity.StudentCourseMemory;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;


@Slf4j
@RestController
@RequiredArgsConstructor
@RequestMapping("/api/tutor")
@Tag(name = "Learning Quiz", description = "AI-generated quiz, assigned quiz, grading review, and click-to-learn APIs")
public class QuizController {

    private final QuizService quizService;
    private final CourseAnswerGateway courseAnswerService;
    private final StudentCourseMemoryService memoryService;
    private final AiConversationService aiConversationService;
    private final ImproveSuggestionService improveSuggestionService;

    @PostMapping("/students/{studentId}/courses/{courseId}/suggestions/learn")
    @Operation(summary = "Continue the current chat from one clicked improve suggestion")
    public ResponseEntity<?> learnFromSuggestion(
            @PathVariable String studentId,
            @PathVariable String courseId,
            @RequestBody LearnSuggestionRequest request
    ) {
        try {
            String topic = resolveSuggestionTopic(request);
            String classId = request == null ? null : request.getClassId();
            String clickedSuggestion = resolveClickedSuggestion(request, topic);
            String question = "Em muốn ôn tập phần \"" + topic + "\" từ improve plan. " +
                    "Hãy hướng dẫn em từng bước trong đoạn chat này, giải thích dễ hiểu, " +
                    "có ví dụ nhỏ và gợi ý em nên tự kiểm tra gì tiếp theo.";

            StudentCourseMemory currentMemory = memoryService.getOrCreateMemory(studentId, courseId);
            if (currentMemory.getRecentQuestions() != null && currentMemory.getRecentQuestions().stream()
                    .anyMatch(item -> item != null && item.equalsIgnoreCase(question))) {
                return ResponseEntity.status(HttpStatus.CONFLICT).body(Map.of(
                        "error", "SUGGESTION_ALREADY_USED",
                        "message", "Improve suggestion này đã được dùng trong course chat. Hãy chọn suggestion khác hoặc hỏi câu mới.",
                        "clickedSuggestion", clickedSuggestion
                ));
            }

            CourseRagAnswer answer = courseAnswerService.askWithConfidence(question, courseId, classId);
            memoryService.recordInteraction(studentId, courseId, classId, question, answer.getAnswer());

            var savedExchange = aiConversationService.saveExchangeWithMessages(
                    studentId,
                    request == null ? null : request.getConversationId(),
                    courseId,
                    classId,
                    question,
                    answer.getAnswer(),
                    null
            );

            SuggestionRequest nextSuggestionRequest = new SuggestionRequest();
            nextSuggestionRequest.setStudentId(studentId);
            nextSuggestionRequest.setCourseId(courseId);
            nextSuggestionRequest.setClassId(classId);
            nextSuggestionRequest.setQuestion(question);
            nextSuggestionRequest.setIncludeAiSuggestion(false);
            SuggestionResponse nextSuggestions = improveSuggestionService.buildSuggestions(nextSuggestionRequest);

            AiQueryResponse response = new AiQueryResponse();
            response.setMode("RAG");
            response.setIntentReason("Learning from clicked improve suggestion");
            response.setIntentConfidence(1.0);
            response.setAnswer(answer.getAnswer());
            response.setConfidence(answer.getConfidence());
            response.setEscalated(Boolean.TRUE.equals(answer.getEscalationRecommended()));
            response.setEscalationReason(answer.getEscalationReason());
            response.setConversationId(savedExchange.conversationId());
            response.setUserMessageId(savedExchange.userMessageId());
            response.setAssistantMessageId(savedExchange.assistantMessageId());
            response.setCourseId(courseId);
            response.setClickedSuggestion(clickedSuggestion);
            response.setSuggestionConsumed(true);
            response.setNextImproveSuggestions(nextSuggestions.getRuleSuggestions());
            response.setNextAiSuggestion(nextSuggestions.getAiSuggestion());
            response.setSources(answer.getSources());
            response.setSourceEvidence(answer.getSourceEvidence());
            response.setGroundingType(answer.getGroundingType());
            return ResponseEntity.ok(response);
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.badRequest().body(quizErrorBody(ex));
        } catch (Exception ex) {
            log.error("Learn from suggestion failed", ex);
            return ResponseEntity.status(ErrorStatus.of(ex)).body(Map.of("error", "Server error: " + ex.getMessage()));
        }
    }

    @PostMapping("/students/{studentId}/courses/{courseId}/quizzes/generate")
    @Operation(summary = "Generate a grounded self-practice quiz from a suggestion or topic")
    public ResponseEntity<?> generateQuiz(
            @PathVariable String studentId,
            @PathVariable String courseId,
            @RequestBody GenerateQuizRequest request
    ) {
        try {
            return ResponseEntity.ok(quizService.toStudentView(quizService.generateQuiz(studentId, courseId, request)));
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.badRequest().body(quizErrorBody(ex));
        } catch (Exception ex) {
            log.error("Generate quiz failed", ex);
            return ResponseEntity.status(ErrorStatus.of(ex)).body(Map.of("error", "Server error: " + ex.getMessage()));
        }
    }

    @GetMapping("/quizzes/{quizSessionId}")
    @Operation(summary = "Get quiz session detail")
    public ResponseEntity<?> getQuiz(@PathVariable String quizSessionId) {
        try {
            return ResponseEntity.ok(quizService.toStudentView(quizService.getQuiz(quizSessionId)));
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.badRequest().body(quizErrorBody(ex));
        } catch (Exception ex) {
            log.error("Get quiz failed", ex);
            return ResponseEntity.status(ErrorStatus.of(ex)).body(Map.of("error", "Server error: " + ex.getMessage()));
        }
    }

    @PostMapping("/quizzes/{quizSessionId}/submit")
    @Operation(summary = "Submit quiz answers and receive AI/backend score")
    public ResponseEntity<?> submitQuiz(
            @PathVariable String quizSessionId,
            @RequestBody SubmitQuizRequest request
    ) {
        try {
            return ResponseEntity.ok(quizService.toStudentView(quizService.submitQuiz(quizSessionId, request)));
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.badRequest().body(quizErrorBody(ex));
        } catch (Exception ex) {
            log.error("Submit quiz failed", ex);
            return ResponseEntity.status(ErrorStatus.of(ex)).body(Map.of("error", "Server error: " + ex.getMessage()));
        }
    }

    @GetMapping("/students/{studentId}/courses/{courseId}/quizzes")
    @Operation(summary = "List quiz history for a student course")
    public ResponseEntity<?> listStudentCourseQuizzes(
            @PathVariable String studentId,
            @PathVariable String courseId
    ) {
        try {
            var quizzes = quizService.listStudentCourseQuizzes(studentId, courseId).stream()
                    .map(quizService::toStudentView)
                    .toList();
            return ResponseEntity.ok(Map.of("studentId", studentId, "courseId", courseId, "count", quizzes.size(), "quizzes", quizzes));
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.badRequest().body(quizErrorBody(ex));
        } catch (Exception ex) {
            log.error("List quizzes failed", ex);
            return ResponseEntity.status(ErrorStatus.of(ex)).body(Map.of("error", "Server error: " + ex.getMessage()));
        }
    }

    private String authenticatedUserId(Authentication authentication) {
        if (authentication == null || authentication.getName() == null) {
            throw new SecurityException("Authentication is required");
        }
        return authentication.getName();
    }

    private String authenticatedRole(Authentication authentication) {
        if (authentication == null || authentication.getAuthorities().isEmpty()) {
            throw new SecurityException("Authentication role is required");
        }
        return authentication.getAuthorities().iterator().next().getAuthority().replaceFirst("^ROLE_", "");
    }

    private Map<String, Object> quizErrorBody(IllegalArgumentException ex) {
        String message = ex.getMessage() == null ? "Invalid quiz request" : ex.getMessage();
        String code = message.contains("NOT_ENOUGH_INDEXED_MATERIAL")
                || message.toLowerCase().contains("tài liệu")
                ? "NOT_ENOUGH_INDEXED_MATERIAL"
                : "VALIDATION_ERROR";
        return Map.of(
                "success", false,
                "status", "FAILED",
                "code", code,
                "error", code,
                "message", message.replace("NOT_ENOUGH_INDEXED_MATERIAL: ", "")
        );
    }

    private String resolveClickedSuggestion(LearnSuggestionRequest request, String topic) {
        if (request == null) {
            return topic;
        }
        if (request.getSuggestionKey() != null && !request.getSuggestionKey().isBlank()) {
            return request.getSuggestionKey().trim();
        }
        if (request.getSuggestionText() != null && !request.getSuggestionText().isBlank()) {
            return request.getSuggestionText().trim();
        }
        return topic;
    }
    private String resolveSuggestionTopic(LearnSuggestionRequest request) {
        if (request == null) {
            throw new IllegalArgumentException("request body is required");
        }
        String topic = request.getTopic() != null && !request.getTopic().isBlank()
                ? request.getTopic()
                : request.getSuggestionText();
        return requireMaxLength(requireText(topic, "topic or suggestionText"), "topic", DEFAULT_TEXT_MAX_LENGTH);
    }
}



