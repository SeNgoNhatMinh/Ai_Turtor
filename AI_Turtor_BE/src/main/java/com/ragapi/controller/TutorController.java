package com.ragapi.controller;
import static com.ragapi.util.ValidationUtils.STUDENT_QUESTION_MAX_LENGTH;
import static com.ragapi.util.ValidationUtils.optionalCodeSnippet;
import static com.ragapi.util.ValidationUtils.requireMaxLength;
import static com.ragapi.util.ValidationUtils.requireText;

import com.ragapi.dto.AiQueryRequest;
import com.ragapi.dto.IntentClassification;
import com.ragapi.dto.IntentClassifyRequest;
import com.ragapi.dto.IntentGuardRequest;
import com.ragapi.dto.TutorIntentContext;
import com.ragapi.harness.routing.IntentClassifierService;
import com.ragapi.harness.routing.TutorQueryService;
import com.ragapi.harness.util.StudentFacingMessages;
import com.ragapi.service.chat.ChatGenerationGate;
import com.ragapi.service.student.StudentDailyQuestionQuotaService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.util.Locale;
import java.util.Map;
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
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import jakarta.servlet.http.HttpServletRequest;

@Slf4j
@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
@Tag(name = "Tutor", description = "AI tutor query, intent routing and diagnostics APIs")
public class TutorController {

    private final StudentDailyQuestionQuotaService questionQuotaService;
    private final IntentClassifierService intentClassifierService;
    private final ChatGenerationGate generationGate;
    private final TutorQueryService tutorQueryService;

    @GetMapping("/tutor/students/{studentId}/courses/{courseId}/question-quota")
    @Operation(summary = "Get today's per-course question quota for a student")
    public ResponseEntity<?> getQuestionQuota(
            @PathVariable String studentId,
            @PathVariable String courseId,
            Authentication authentication
    ) {
        try {
            if (tutorQueryService.isStudent(authentication) && !authentication.getName().equals(studentId)) {
                return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("error", "Forbidden"));
            }
            StudentDailyQuestionQuotaService.QuotaUsage usage = questionQuotaService.currentUsage(studentId, courseId);
            return ResponseEntity.ok(Map.of(
                    "courseId", usage.courseId(),
                    "used", usage.used(),
                    "remaining", usage.remaining(),
                    "dailyLimit", questionQuotaService.dailyLimit(),
                    "resetAt", usage.resetAt().toString()
            ));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @PostMapping("/tutor/intent-classify")
    @Operation(summary = "Classify a student question for n8n AI Harness routing")
    public ResponseEntity<?> classifyIntent(@RequestBody IntentClassifyRequest request, Authentication authentication) {
        try {
            if (request == null) {
                return ResponseEntity.badRequest().body(Map.of("error", "request body is required"));
            }
            String rawQuestion = request.getMessage() != null && !request.getMessage().isBlank()
                    ? request.getMessage()
                    : request.getQuestion();
            String question = tutorQueryService.normalizeStudentQuestion(
                    requireMaxLength(rawQuestion, "question", STUDENT_QUESTION_MAX_LENGTH)
            );
            String codeSnippet = optionalCodeSnippet(request.getCodeSnippet(), "codeSnippet");
            String courseId = requireText(request.getCourseId(), "courseId");
            if (tutorQueryService.isStudent(authentication)) {
                questionQuotaService.consume(authentication.getName(), courseId);
            }
            String userId = tutorQueryService.isStudent(authentication) ? authentication.getName() : request.getStudentId();
            TutorIntentContext intentContext = tutorQueryService.resolveIntentContext(
                    request.getConversationId(),
                    request.getTutorSessionId(),
                    request.getSessionPhase(),
                    userId
            );

            IntentClassification intent = tutorQueryService.classifyStudentIntent(
                    question,
                    codeSnippet,
                    courseId,
                    intentContext,
                    Boolean.TRUE.equals(request.getDeferAgent())
            );

            Map<String, Object> body = tutorQueryService.classificationBody(
                    request.getStudentId(), request.getCourseId(), request.getClassId(), question, intent);
            body.put("improvePlanId", request.getImprovePlanId());
            body.put("planItemId", request.getPlanItemId());
            body.put("clickedSuggestion", request.getClickedSuggestion());
            if ("NEEDS_AGENT".equals(intent.getRoutingStrategy())) {
                body.put("recentHistory", intentContext.recentHistory() == null ? "" : intentContext.recentHistory());
            }
            return ResponseEntity.ok(body);
        } catch (StudentDailyQuestionQuotaService.QuestionQuotaExceededException e) {
            String message = StudentFacingMessages.dailySessionComplete(e.getCourseId());
            return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS).body(Map.of(
                    "error", message, "message", message,
                    "code", "DAILY_COURSE_QUESTION_LIMIT_REACHED", "courseId", e.getCourseId(),
                    "dailyLimit", e.getDailyLimit(), "remaining", 0, "resetAt", e.getResetAt().toString()
            ));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        } catch (Exception e) {
            log.error("Intent classification failed", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Server error: " + e.getMessage()));
        }
    }

    @PostMapping("/tutor/intent-guard")
    @Operation(summary = "Apply harness policy to the n8n AI Agent decision")
    public ResponseEntity<?> guardIntent(@RequestBody IntentGuardRequest request, Authentication authentication) {
        try {
            if (request == null) {
                return ResponseEntity.badRequest().body(Map.of("error", "request body is required"));
            }
            String rawQuestion = request.getMessage() != null && !request.getMessage().isBlank()
                    ? request.getMessage()
                    : request.getQuestion();
            String question = tutorQueryService.normalizeStudentQuestion(
                    requireMaxLength(rawQuestion, "question", STUDENT_QUESTION_MAX_LENGTH)
            );
            String courseId = requireText(request.getCourseId(), "courseId");
            String mode = request.getMode() == null ? "" : request.getMode().trim().toUpperCase(Locale.ROOT);
            IntentClassification proposed = mode.isBlank() ? null : IntentClassification.builder()
                    .mode(mode)
                    .subIntent(request.getSubIntent())
                    .domain(request.getDomain())
                    .reason(request.getReason() == null || request.getReason().isBlank()
                            ? "n8n AI Agent selected the worker"
                            : request.getReason().trim())
                    .confidence(request.getConfidence() == null ? 0.8 : request.getConfidence())
                    .requiresCourseMaterial(IntentClassifierService.MODE_RAG.equals(mode))
                    .routingStrategy("HARNESS_AGENT")
                    .answerPolicy("Decision from the n8n harness agent")
                    .build();
            IntentClassification intent = intentClassifierService.applyHarnessAgentDecision(
                    question, proposed, request.getDomain());
            return ResponseEntity.ok(tutorQueryService.classificationBody("", courseId, "", question, intent));
        } catch (StudentDailyQuestionQuotaService.QuestionQuotaExceededException e) {
            String message = StudentFacingMessages.dailySessionComplete(e.getCourseId());
            return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS).body(Map.of(
                    "error", message, "message", message,
                    "code", "DAILY_COURSE_QUESTION_LIMIT_REACHED", "courseId", e.getCourseId(),
                    "dailyLimit", e.getDailyLimit(), "remaining", 0, "resetAt", e.getResetAt().toString()
            ));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        } catch (Exception e) {
            log.error("Intent guard failed", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Server error: " + e.getMessage()));
        }
    }

    @PostMapping("/tutor/workers/refuse")
    @Operation(summary = "Run the harness refuse worker. Does not retrieve course material.")
    public ResponseEntity<?> refuseWorker(
            @RequestBody AiQueryRequest request,
            @RequestParam(value = "userId", required = false) String userId,
            @RequestParam(value = "userName", required = false) String userName,
            @RequestParam(value = "userEmail", required = false) String userEmail,
            Authentication authentication
    ) {
        AiQueryRequest routed = request == null ? new AiQueryRequest() : request;
        routed.setHarnessMode(IntentClassifierService.MODE_REFUSE);
        routed.setHarnessSubIntent("OFF_TOPIC");
        if (routed.getHarnessReason() == null || routed.getHarnessReason().isBlank()) {
            routed.setHarnessReason("Harness selected the refuse worker");
        }
        return tutorQueryService.query(routed, userId, userName, userEmail, authentication, null);
    }

    @PostMapping("/tutor/workers/curriculum")
    @Operation(summary = "Run the harness curriculum worker for a course greeting.")
    public ResponseEntity<?> curriculumWorker(
            @RequestBody AiQueryRequest request,
            @RequestParam(value = "userId", required = false) String userId,
            @RequestParam(value = "userName", required = false) String userName,
            @RequestParam(value = "userEmail", required = false) String userEmail,
            Authentication authentication
    ) {
        AiQueryRequest routed = request == null ? new AiQueryRequest() : request;
        routed.setHarnessMode(IntentClassifierService.MODE_CURRICULUM);
        routed.setHarnessSubIntent(IntentClassifierService.MODE_CURRICULUM);
        if (routed.getHarnessReason() == null || routed.getHarnessReason().isBlank()) {
            routed.setHarnessReason("Harness selected the curriculum worker");
        }
        return tutorQueryService.query(routed, userId, userName, userEmail, authentication, null);
    }

    @PostMapping("/ai/generations/cancel")
    public ResponseEntity<?> cancelGeneration(
            @RequestBody(required = false) Map<String, String> body,
            Authentication authentication
    ) {
        if (authentication == null || authentication.getName() == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("error", "Unauthenticated"));
        }
        String traceId = body == null ? "" : body.getOrDefault("traceId", "");
        boolean cancelled = generationGate.cancel(traceId, authentication.getName());
        return ResponseEntity.ok(Map.of("cancelled", cancelled));
    }

    @PostMapping("/ai/query")
    @Operation(summary = "Ask the AI tutor using intent classification")
    public ResponseEntity<?> query(
            @RequestBody AiQueryRequest request,
            @RequestParam(value = "userId", required = false) String userId,
            @RequestParam(value = "userName", required = false) String userName,
            @RequestParam(value = "userEmail", required = false) String userEmail,
            Authentication authentication,
            HttpServletRequest httpRequest
    ) {
        return tutorQueryService.query(request, userId, userName, userEmail, authentication, httpRequest);
    }
}
