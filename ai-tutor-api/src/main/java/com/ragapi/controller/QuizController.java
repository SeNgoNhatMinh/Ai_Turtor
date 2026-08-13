package com.ragapi.controller;

import com.ragapi.dto.AiQueryResponse;
import com.ragapi.dto.CourseRagAnswer;
import com.ragapi.dto.CreateTeacherQuizRequest;
import com.ragapi.dto.GenerateQuizAssignmentRequest;
import com.ragapi.dto.GenerateQuizRequest;
import com.ragapi.dto.LearnSuggestionRequest;
import com.ragapi.dto.SuggestionRequest;
import com.ragapi.dto.SuggestionResponse;
import com.ragapi.dto.PublishQuizAssignmentRequest;
import com.ragapi.dto.SubmitQuizRequest;
import com.ragapi.dto.TeacherReviewQuizRequest;
import com.ragapi.dto.UpdateQuizAssignmentRequest;
import com.ragapi.service.AiConversationService;
import com.ragapi.service.CourseRagService;
import com.ragapi.service.ImproveSuggestionService;
import com.ragapi.service.QuizService;
import com.ragapi.service.StudentCourseMemoryService;
import com.ragapi.entity.StudentCourseMemory;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

import static com.ragapi.util.ValidationUtils.DEFAULT_TEXT_MAX_LENGTH;
import static com.ragapi.util.ValidationUtils.requireMaxLength;
import static com.ragapi.util.ValidationUtils.requireText;

@Slf4j
@RestController
@RequiredArgsConstructor
@RequestMapping("/api/tutor")
@Tag(name = "Learning Quiz", description = "AI-generated quiz, assigned quiz, grading review, and click-to-learn APIs")
public class QuizController {

    private final QuizService quizService;
    private final CourseRagService courseRagService;
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

            CourseRagAnswer answer = courseRagService.askWithConfidence(question, courseId, classId);
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
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(Map.of("error", "Server error: " + ex.getMessage()));
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
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(Map.of("error", "Server error: " + ex.getMessage()));
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
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(Map.of("error", "Server error: " + ex.getMessage()));
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
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(Map.of("error", "Server error: " + ex.getMessage()));
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
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(Map.of("error", "Server error: " + ex.getMessage()));
        }
    }

    @PostMapping("/teachers/{teacherId}/courses/{courseId}/quiz-assignments/generate")
    @Operation(summary = "Generate a draft quiz assignment for teacher review")
    public ResponseEntity<?> generateQuizAssignment(
            @PathVariable String teacherId,
            @PathVariable String courseId,
            @RequestBody GenerateQuizAssignmentRequest request
    ) {
        try {
            return ResponseEntity.ok(quizService.generateAssignmentDraft(teacherId, courseId, request));
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.badRequest().body(quizErrorBody(ex));
        } catch (Exception ex) {
            log.error("Generate quiz assignment failed", ex);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(Map.of("error", "Server error: " + ex.getMessage()));
        }
    }

    @PutMapping("/quiz-assignments/{assignmentId}")
    @Operation(summary = "Update draft quiz assignment before publishing")
    public ResponseEntity<?> updateQuizAssignment(
            @PathVariable String assignmentId,
            @RequestBody UpdateQuizAssignmentRequest request
    ) {
        try {
            return ResponseEntity.ok(quizService.updateAssignment(assignmentId, request));
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.badRequest().body(quizErrorBody(ex));
        } catch (Exception ex) {
            log.error("Update quiz assignment failed", ex);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(Map.of("error", "Server error: " + ex.getMessage()));
        }
    }

    @DeleteMapping("/quiz-assignments/{assignmentId}")
    @Operation(summary = "Delete draft quiz assignment")
    public ResponseEntity<?> deleteQuizAssignment(@PathVariable String assignmentId) {
        try {
            quizService.deleteAssignment(assignmentId);
            return ResponseEntity.ok(Map.of("status", "DELETED", "assignmentId", assignmentId));
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.badRequest().body(quizErrorBody(ex));
        } catch (Exception ex) {
            log.error("Delete quiz assignment failed", ex);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(Map.of("error", "Server error: " + ex.getMessage()));
        }
    }

    @PostMapping("/quiz-assignments/{assignmentId}/publish")
    @Operation(summary = "Publish quiz assignment to whole class or selected students")
    public ResponseEntity<?> publishQuizAssignment(
            @PathVariable String assignmentId,
            @RequestBody PublishQuizAssignmentRequest request
    ) {
        try {
            return ResponseEntity.ok(quizService.publishAssignment(assignmentId, request));
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.badRequest().body(quizErrorBody(ex));
        } catch (Exception ex) {
            log.error("Publish quiz assignment failed", ex);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(Map.of("error", "Server error: " + ex.getMessage()));
        }
    }

    @GetMapping("/teachers/{teacherId}/quiz-assignments")
    @Operation(summary = "List quiz assignments created by a teacher")
    public ResponseEntity<?> listTeacherQuizAssignments(@PathVariable String teacherId) {
        try {
            var assignments = quizService.listTeacherAssignments(teacherId);
            return ResponseEntity.ok(Map.of("teacherId", teacherId, "count", assignments.size(), "assignments", assignments));
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.badRequest().body(quizErrorBody(ex));
        } catch (Exception ex) {
            log.error("List teacher quiz assignments failed", ex);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(Map.of("error", "Server error: " + ex.getMessage()));
        }
    }

    @GetMapping("/teachers/{teacherId}/quiz-attempts")
    @Operation(summary = "List assigned quiz attempts for teacher review")
    public ResponseEntity<?> listTeacherQuizAttempts(
            @PathVariable String teacherId,
            @RequestParam(value = "status", required = false) String status,
            @RequestParam(value = "reviewStatus", required = false) String reviewStatus,
            @RequestParam(value = "courseId", required = false) String courseId,
            @RequestParam(value = "classId", required = false) String classId,
            @RequestParam(value = "assignmentId", required = false) String assignmentId,
            @RequestParam(value = "studentId", required = false) String studentId,
            @RequestParam(value = "page", defaultValue = "0") int page,
            @RequestParam(value = "size", defaultValue = "20") int size,
            Authentication authentication) {
        try {
            return ResponseEntity.ok(quizService.listTeacherQuizAttempts(
                    teacherId, authenticatedUserId(authentication), authenticatedRole(authentication),
                    status, reviewStatus, courseId, classId, assignmentId, studentId, page, size));
        } catch (SecurityException ex) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("error", ex.getMessage()));
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.badRequest().body(quizErrorBody(ex));
        } catch (Exception ex) {
            log.error("List teacher quiz attempts failed", ex);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(Map.of("error", "Server error: " + ex.getMessage()));
        }
    }

    @PostMapping("/teachers/{teacherId}/courses/{courseId}/quiz-assignments/manual")
    @Operation(summary = "Create an online teacher-authored quiz draft without AI generation")
    public ResponseEntity<?> createManualTeacherQuiz(
            @PathVariable String teacherId,
            @PathVariable String courseId,
            @RequestBody CreateTeacherQuizRequest request
    ) {
        try {
            return ResponseEntity.ok(quizService.createTeacherQuizDraft(teacherId, courseId, request));
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.badRequest().body(quizErrorBody(ex));
        } catch (Exception ex) {
            log.error("Create manual teacher quiz failed", ex);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(Map.of("error", "Server error: " + ex.getMessage()));
        }
    }

    @GetMapping("/students/{studentId}/courses/{courseId}/quiz-assignments")
    @Operation(summary = "List published quiz assignments available to a student")
    public ResponseEntity<?> listStudentQuizAssignments(
            @PathVariable String studentId,
            @PathVariable String courseId,
            @RequestParam(value = "classId", required = false) String classId
    ) {
        try {
            var assignments = quizService.listPublishedAssignmentsForStudent(studentId, courseId, classId);
            return ResponseEntity.ok(Map.of("studentId", studentId, "courseId", courseId, "count", assignments.size(), "assignments", assignments));
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.badRequest().body(quizErrorBody(ex));
        } catch (Exception ex) {
            log.error("List student quiz assignments failed", ex);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(Map.of("error", "Server error: " + ex.getMessage()));
        }
    }

    @PostMapping("/quiz-assignments/{assignmentId}/attempts")
    @Operation(summary = "Start an attempt for an assigned quiz")
    public ResponseEntity<?> startAssignedQuiz(
            @PathVariable String assignmentId,
            @RequestParam String studentId
    ) {
        try {
            return ResponseEntity.ok(quizService.toStudentView(quizService.startAssignmentAttempt(assignmentId, studentId)));
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.badRequest().body(quizErrorBody(ex));
        } catch (Exception ex) {
            log.error("Start assigned quiz failed", ex);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(Map.of("error", "Server error: " + ex.getMessage()));
        }
    }

    @PutMapping("/quizzes/{quizSessionId}/teacher-review")
    @Operation(summary = "Teacher reviews AI-scored quiz result")
    public ResponseEntity<?> teacherReviewQuiz(
            @PathVariable String quizSessionId,
            @RequestBody TeacherReviewQuizRequest request,
            Authentication authentication
    ) {
        try {
            return ResponseEntity.ok(quizService.teacherReviewQuiz(
                    quizSessionId, request,
                    authenticatedUserId(authentication), authenticatedRole(authentication)));
        } catch (SecurityException ex) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("error", ex.getMessage()));
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.badRequest().body(quizErrorBody(ex));
        } catch (Exception ex) {
            log.error("Teacher review quiz failed", ex);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(Map.of("error", "Server error: " + ex.getMessage()));
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
