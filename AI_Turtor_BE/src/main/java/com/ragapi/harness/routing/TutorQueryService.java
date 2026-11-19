package com.ragapi.harness.routing;

import static com.ragapi.util.ValidationUtils.STUDENT_QUESTION_MAX_LENGTH;
import static com.ragapi.util.ValidationUtils.optionalCodeSnippet;
import static com.ragapi.util.ValidationUtils.requireMaxLength;
import static com.ragapi.util.ValidationUtils.requireText;

import com.ragapi.dto.AiQueryRequest;
import com.ragapi.dto.AiQueryResponse;
import com.ragapi.dto.CodeMentorRequest;
import com.ragapi.dto.CourseRagAnswer;
import com.ragapi.dto.HarnessLogRequest;
import com.ragapi.dto.IntentClassification;
import com.ragapi.dto.RagQueryIntent;
import com.ragapi.dto.RagSourceEvidence;
import com.ragapi.dto.SuggestionItem;
import com.ragapi.dto.TutorIntentContext;
import com.ragapi.harness.entity.QuestionEscalation;
import com.ragapi.harness.entity.TutorSession;
import com.ragapi.harness.answer.generation.SupportLevelPrompt;
import com.ragapi.harness.behavior.plan.StudentLearningContext;
import com.ragapi.harness.behavior.plan.StudentLearningContextService;
import com.ragapi.harness.behavior.plan.TeachingOrchestrator;
import com.ragapi.harness.behavior.plan.TeachingPlan;
import com.ragapi.harness.codementor.CodeMentorService;
import com.ragapi.harness.curriculum.CourseChapterExcerptCache;
import com.ragapi.harness.curriculum.CourseCurriculumOverviewService;
import com.ragapi.harness.directive.PedagogicalDirectiveService;
import com.ragapi.harness.gateway.CourseAnswerGateway;
import com.ragapi.harness.improve.ImprovePlanService;
import com.ragapi.harness.learning.LearningPathGroundingService;
import com.ragapi.harness.memory.StudentCourseMemoryService;
import com.ragapi.harness.session.TutorSessionService;
import com.ragapi.harness.trace.HarnessLogService;
import com.ragapi.harness.util.ChapterHeadingUtils;
import com.ragapi.harness.util.ConversationFocus;
import com.ragapi.harness.util.HarnessRouting;
import com.ragapi.harness.util.LearningPathParser;
import com.ragapi.harness.util.RagStageTimer;
import com.ragapi.harness.util.StudentChatIntentDetector;
import com.ragapi.harness.util.StudentFacingMessages;
import com.ragapi.service.chat.AiConversationService;
import com.ragapi.service.chat.ChatGenerationGate;
import com.ragapi.service.student.StudentDailyQuestionQuotaService;
import com.ragapi.harness.handoff.MentorEscalationService;
import jakarta.servlet.http.HttpServletRequest;
import java.io.IOException;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

/** Runs one student question from routing through the saved answer. */
@Slf4j
@Service
@RequiredArgsConstructor
public class TutorQueryService {

    final CourseAnswerGateway courseAnswerService;
    final MentorEscalationService mentorEscalationService;
    final AiConversationService aiConversationService;
    final StudentCourseMemoryService studentCourseMemoryService;
    final CodeMentorService codeMentorService;
    final IntentClassifierService intentClassifierService;
    final StudentDailyQuestionQuotaService questionQuotaService;
    final StudentQuestionNormalizationService questionNormalizationService;
    final PedagogicalDirectiveService pedagogicalDirectiveService;
    final TeachingOrchestrator teachingOrchestrator;
    final StudentLearningContextService studentLearningContextService;
    final TutorSessionService tutorSessionService;
    final ImprovePlanService improvePlanService;
    final LearningPathGroundingService learningPathGroundingService;
    final CourseCurriculumOverviewService curriculumOverviewService;
    final CourseChapterExcerptCache chapterExcerptCache;
    final HarnessLogService harnessLogService;
    final ChatGenerationGate generationGate;

    public ResponseEntity<?> query(
            AiQueryRequest request,
            String userId,
            String userName,
            String userEmail,
            Authentication authentication,
            HttpServletRequest httpRequest
    ) {
        TutorQueryTurn turn = new TutorQueryTurn(this);
        try {
            return turn.run(request, userId, userName, userEmail, authentication, httpRequest);
        } catch (ChatGenerationGate.GenerationCancelledException cancelled) {
            if (turn.quotaCharged && userId != null) {
                try {
                    questionQuotaService.releaseOne(userId, request == null ? null : request.getCourseId());
                } catch (RuntimeException refundError) {
                    log.warn("Could not refund a cancelled question: {}", refundError.getMessage());
                }
            }
            log.info("Student stopped generation for trace {}", turn.generationTraceId);
            return ResponseEntity.status(HttpStatus.CONFLICT).body(Map.of(
                    "cancelled", true,
                    "answer", "",
                    "code", "GENERATION_CANCELLED"
            ));
        } catch (StudentDailyQuestionQuotaService.QuestionQuotaExceededException e) {
            String message = StudentFacingMessages.dailySessionComplete(e.getCourseId());
            return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS).body(Map.of(
                    "error", message,
                    "message", message,
                    "code", "DAILY_COURSE_QUESTION_LIMIT_REACHED",
                    "courseId", e.getCourseId(),
                    "dailyLimit", e.getDailyLimit(),
                    "remaining", 0,
                    "resetAt", e.getResetAt().toString()
            ));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        } catch (SecurityException e) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("error", e.getMessage()));
        } catch (IOException e) {
            log.error("Course material search failed during AI query", e);
            AiQueryResponse response = new AiQueryResponse();
            response.setMode(IntentClassifierService.MODE_RAG);
            response.setAnswer("Hệ thống chưa truy cập được kho tài liệu môn học để AI Tutor trả lời chắc chắn. Câu hỏi cần được chuyển cho giáo viên/mentor phụ trách.");
            response.setConfidence(0.0);
            response.setSources(List.of());
            response.setEscalated(true);
            response.setOutcome("NEEDS_MENTOR");
            response.setEscalationReason("Course material search unavailable");
            response.setConversationId(request != null ? request.getConversationId() : null);

            try {
                if (request != null && userId != null && !userId.isBlank()
                        && request.getCourseId() != null && !request.getCourseId().isBlank()) {
                    QuestionEscalation escalation = mentorEscalationService.createQuestionEscalation(
                            userId,
                            userEmail != null ? userEmail : "user@example.com",
                            userName != null ? userName : userId,
                            resolveQuestion(request),
                            "Course material search unavailable.",
                            request.getCourseId(),
                            normalizeScopeValue(request.getClassId())
                    );
                    response.setQuestionEscalationId(escalation.getId());
                }
            } catch (Exception escalationError) {
                log.warn("Could not create escalation after course material search failure", escalationError);
            }

            return ResponseEntity.ok(response);
        } catch (Exception e) {
            if (e instanceof ChatGenerationGate.GenerationCancelledException || isCancelledCause(e)) {
                if (turn.quotaCharged && userId != null) {
                    try {
                        questionQuotaService.releaseOne(userId, request == null ? null : request.getCourseId());
                    } catch (RuntimeException refundError) {
                        log.warn("Could not refund a cancelled question: {}", refundError.getMessage());
                    }
                }
                return ResponseEntity.status(HttpStatus.CONFLICT).body(Map.of(
                        "cancelled", true,
                        "answer", "",
                        "code", "GENERATION_CANCELLED"
                ));
            }
            log.error("Unexpected error during AI query", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Server error: " + e.getMessage()));
        } finally {
            generationGate.release(turn.generationTraceId);
        }
    }

    static String resolveGenerationTraceId(AiQueryRequest request, HttpServletRequest httpRequest) {
        String header = httpRequest == null ? "" : httpRequest.getHeader("X-Trace-Id");
        if (header != null && !header.isBlank()) return header.trim();
        return "";
    }

    private static boolean isCancelledCause(Throwable error) {
        Throwable current = error;
        while (current != null) {
            if (current instanceof ChatGenerationGate.GenerationCancelledException) return true;
            current = current.getCause();
        }
        return false;
    }

    public boolean isStudent(Authentication authentication) {
        return authentication != null && authentication.getAuthorities().stream()
                .anyMatch(authority -> "ROLE_STUDENT".equals(authority.getAuthority()));
    }

    public TutorIntentContext resolveIntentContext(
            String conversationId,
            String tutorSessionId,
            String sessionPhase,
            String userId
    ) {
        String classifierHistory = aiConversationService.buildRecentTutorContextForClassifier(
                conversationId, userId);
        String topic = null;
        String phase = sessionPhase;
        if (tutorSessionId != null && !tutorSessionId.isBlank()) {
            try {
                TutorSession activeSession = tutorSessionService.getSession(tutorSessionId);
                topic = activeSession.getTopic();
                if (activeSession.getPhase() != null && !activeSession.getPhase().isBlank()) {
                    phase = activeSession.getPhase();
                }
            } catch (RuntimeException sessionError) {
                log.debug("Tutor session unavailable for intent context: {}", sessionError.getMessage());
            }
        }
        return new TutorIntentContext(classifierHistory, phase, topic);
    }

    String resolveQuestion(AiQueryRequest request) {
        if (request.getMessage() != null && !request.getMessage().isBlank()) {
            return request.getMessage();
        }
        return request.getQuestion();
    }

    String normalizeScopeValue(String value) {
        return value != null && !value.isBlank() ? value.trim() : null;
    }

    public String normalizeStudentQuestion(String question) {
        long started = RagStageTimer.start();
        try {
            return questionNormalizationService.normalize(question);
        } finally {
            RagStageTimer.record("T2_NORMALIZATION", started);
        }
    }

    IntentClassification classifyStudentIntent(
            String question,
            String codeSnippet,
            String courseId,
            TutorIntentContext context
    ) {
        return classifyStudentIntent(question, codeSnippet, courseId, context, false);
    }

    public IntentClassification classifyStudentIntent(
            String question,
            String codeSnippet,
            String courseId,
            TutorIntentContext context,
            boolean deferAgent
    ) {
        long started = RagStageTimer.start();
        try {
            return intentClassifierService.classify(question, codeSnippet, courseId, context, deferAgent);
        } finally {
            RagStageTimer.record("T3_INTENT_CLASSIFICATION", started);
        }
    }

    public Map<String, Object> classificationBody(
            String studentId,
            String courseId,
            String classId,
            String question,
            IntentClassification intent
    ) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("studentId", studentId == null ? "" : studentId);
        body.put("courseId", courseId == null ? "" : courseId);
        body.put("classId", classId == null ? "" : classId);
        body.put("message", question);
        body.put("mode", intent.getMode());
        body.put("reason", intent.getReason());
        body.put("confidence", intent.getConfidence());
        body.put("subIntent", intent.getSubIntent());
        body.put("domain", intent.getDomain());
        body.put("answerPolicy", intent.getAnswerPolicy());
        body.put("requiresCourseMaterial", intent.getRequiresCourseMaterial());
        body.put("routingStrategy", intent.getRoutingStrategy());
        return body;
    }

    RagQueryIntent buildSourceBackedIntent(AiQueryRequest request, String question) {
        if (request == null) {
            return null;
        }
        boolean guidedLesson = "GUIDED_LESSON".equalsIgnoreCase(request.getInteractionType());
        if (!guidedLesson
                && !"SOURCE_BACKED_STUDY_TIP".equalsIgnoreCase(request.getInteractionType())) {
            return null;
        }
        List<String> materialIds = cleanProvenanceIds(request.getSourceMaterialIds());
        String chapterKey = normalizeScopeValue(request.getChapterKey());
        String chapterTitle = normalizeScopeValue(request.getChapterTitle());
        if (materialIds.isEmpty() && chapterKey == null) {
            return null;
        }
        String clickedSuggestion = request.getClickedSuggestion() == null
                ? question
                : request.getClickedSuggestion().trim();
        return RagQueryIntent.builder()
                .learningObjective(clickedSuggestion)
                .retrievalQuery(clickedSuggestion)
                .retrievalTerms(List.of(clickedSuggestion))
                .teachingMode(guidedLesson ? "LESSON_TEACH" : "EXPLAIN_CONCEPT")
                .chapterKey(chapterKey)
                .chapterTitle(chapterTitle)
                .sourceMaterialIds(materialIds)
                .sourceChunkIds(cleanProvenanceIds(request.getSourceChunkIds()))
                .sourceTerms(List.of(clickedSuggestion))
                .build();
    }

    RagQueryIntent buildUnderstandingRemediationIntent(
            AiQueryRequest request,
            String userId,
            String question
    ) {
        if (request == null
                || !"UNDERSTANDING_REMEDIATION".equalsIgnoreCase(request.getInteractionType())
                || request.getOriginAssistantMessageId() == null
                || request.getOriginAssistantMessageId().isBlank()
                || request.getUnderstandingAttemptId() == null
                || request.getUnderstandingAttemptId().isBlank()) {
            return null;
        }
        return aiConversationService.buildUnderstandingRemediationIntent(
                request.getOriginAssistantMessageId(),
                request.getUnderstandingAttemptId(),
                userId,
                request.getOriginalQuestion() == null ? question : request.getOriginalQuestion()
        );
    }

    List<String> cleanProvenanceIds(List<String> values) {
        if (values == null) {
            return List.of();
        }
        return values.stream()
                .filter(value -> value != null && !value.isBlank())
                .map(String::trim)
                .filter(value -> value.length() <= 200)
                .distinct()
                .limit(12)
                .toList();
    }

    boolean isUnderstandingRemediation(String question) {
        return question != null
                && question.stripLeading().startsWith("Ôn lại sau câu ");
    }
}
