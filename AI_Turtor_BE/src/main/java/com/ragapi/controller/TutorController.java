package com.ragapi.controller;

import com.ragapi.dto.AiQueryRequest;
import com.ragapi.dto.AiQueryResponse;
import com.ragapi.dto.CodeMentorRequest;
import com.ragapi.dto.CourseRagAnswer;
import com.ragapi.dto.IntentClassification;
import com.ragapi.dto.IntentClassifyRequest;
import com.ragapi.dto.RagQueryIntent;
import com.ragapi.dto.SuggestionItem;
import com.ragapi.dto.TutorIntentContext;
import com.ragapi.entity.QuestionEscalation;
import com.ragapi.entity.TutorSession;
import com.ragapi.service.AiConversationService;
import com.ragapi.service.CodeMentorService;
import com.ragapi.service.course.gateway.CourseAnswerGateway;
import com.ragapi.service.ImprovePlanService;
import com.ragapi.service.IntentClassifierService;
import com.ragapi.service.MentorEscalationService;
import com.ragapi.service.PedagogicalDirectiveService;
import com.ragapi.service.StudentCourseMemoryService;
import com.ragapi.service.StudentDailyQuestionQuotaService;
import com.ragapi.service.StudentQuestionNormalizationService;
import com.ragapi.service.TutorSessionService;
import com.ragapi.util.ConversationFocus;
import com.ragapi.util.HarnessRouting;
import com.ragapi.util.LearningPathParser;
import com.ragapi.util.StudentChatIntentDetector;
import com.ragapi.util.StudentFacingMessages;
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
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.io.IOException;
import java.util.List;
import java.util.Locale;
import java.util.Map;

import static com.ragapi.util.ValidationUtils.STUDENT_QUESTION_MAX_LENGTH;
import static com.ragapi.util.ValidationUtils.optionalCodeSnippet;
import static com.ragapi.util.ValidationUtils.requireMaxLength;
import static com.ragapi.util.ValidationUtils.requireText;

@Slf4j
@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
@Tag(name = "Tutor", description = "AI tutor query, intent routing and diagnostics APIs")
public class TutorController {

    private final CourseAnswerGateway courseAnswerService;
    private final MentorEscalationService mentorEscalationService;
    private final AiConversationService aiConversationService;
    private final StudentCourseMemoryService studentCourseMemoryService;
    private final CodeMentorService codeMentorService;
    private final IntentClassifierService intentClassifierService;
    private final StudentDailyQuestionQuotaService questionQuotaService;
    private final StudentQuestionNormalizationService questionNormalizationService;
    private final PedagogicalDirectiveService pedagogicalDirectiveService;
    private final TutorSessionService tutorSessionService;
    private final ImprovePlanService improvePlanService;

    @GetMapping("/tutor/students/{studentId}/courses/{courseId}/question-quota")
    @Operation(summary = "Get today's per-course question quota for a student")
    public ResponseEntity<?> getQuestionQuota(
            @PathVariable String studentId,
            @PathVariable String courseId,
            Authentication authentication
    ) {
        try {
            if (isStudent(authentication) && !authentication.getName().equals(studentId)) {
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
            String question = normalizeStudentQuestion(
                    requireMaxLength(rawQuestion, "question", STUDENT_QUESTION_MAX_LENGTH)
            );
            String codeSnippet = optionalCodeSnippet(request.getCodeSnippet(), "codeSnippet");
            String courseId = requireText(request.getCourseId(), "courseId");
            if (isStudent(authentication)) {
                questionQuotaService.consume(authentication.getName(), courseId);
            }
            String userId = isStudent(authentication) ? authentication.getName() : request.getStudentId();
            TutorIntentContext intentContext = resolveIntentContext(
                    request.getConversationId(),
                    request.getTutorSessionId(),
                    request.getSessionPhase(),
                    userId
            );

            IntentClassification intent = intentClassifierService.classify(
                    question,
                    codeSnippet,
                    courseId,
                    intentContext
            );

            Map<String, Object> body = new java.util.LinkedHashMap<>();
            body.put("studentId", request.getStudentId() == null ? "" : request.getStudentId());
            body.put("courseId", request.getCourseId() == null ? "" : request.getCourseId());
            body.put("classId", request.getClassId() == null ? "" : request.getClassId());
            body.put("message", question);
            body.put("mode", intent.getMode());
            body.put("reason", intent.getReason());
            body.put("confidence", intent.getConfidence());
            body.put("subIntent", intent.getSubIntent());
            body.put("domain", intent.getDomain());
            body.put("answerPolicy", intent.getAnswerPolicy());
            body.put("requiresCourseMaterial", intent.getRequiresCourseMaterial());
            body.put("routingStrategy", intent.getRoutingStrategy());
            body.put("improvePlanId", request.getImprovePlanId());
            body.put("planItemId", request.getPlanItemId());
            body.put("clickedSuggestion", request.getClickedSuggestion());
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

    @PostMapping("/ai/query")
    @Operation(summary = "Ask the AI tutor using intent classification")
    public ResponseEntity<?> query(
            @RequestBody AiQueryRequest request,
            @RequestParam(value = "userId", required = false) String userId,
            @RequestParam(value = "userName", required = false) String userName,
            @RequestParam(value = "userEmail", required = false) String userEmail,
            Authentication authentication
    ) {
        try {
            if (request == null) {
                return ResponseEntity.badRequest().body(Map.of("error", "request body is required"));
            }
            if (isStudent(authentication)) {
                userId = authentication.getName();
            }
            String question = normalizeStudentQuestion(
                    requireMaxLength(resolveQuestion(request), "question", STUDENT_QUESTION_MAX_LENGTH)
            );
            String codeSnippet = optionalCodeSnippet(request.getCodeSnippet(), "codeSnippet");
            String courseId = requireText(request.getCourseId(), "courseId");
            String classId = normalizeScopeValue(request.getClassId());
            boolean persistTurn = !Boolean.FALSE.equals(request.getPersist());
            if (isStudent(authentication) && persistTurn && !Boolean.TRUE.equals(request.getQuotaConsumed())) {
                questionQuotaService.consume(authentication.getName(), courseId);
            }
            String recentHistoryContext = "";
            try {
                recentHistoryContext = aiConversationService.buildRecentTutorContext(
                        request.getConversationId(), userId);
            } catch (RuntimeException historyError) {
                log.warn("Tutor history unavailable; continuing without chat context: {}", historyError.getMessage());
            }
            String sessionTopic = null;
            String sessionPhase = request.getSessionPhase();
            String sessionSupportLevel = "STANDARD";
            List<String> sessionSuggestedTopics = List.of();
            if (request.getTutorSessionId() != null && !request.getTutorSessionId().isBlank()) {
                try {
                    TutorSession activeSession = tutorSessionService.getSession(request.getTutorSessionId());
                    sessionTopic = activeSession.getTopic();
                    if (activeSession.getPhase() != null && !activeSession.getPhase().isBlank()) {
                        sessionPhase = activeSession.getPhase();
                    }
                    if (activeSession.getSupportLevel() != null && !activeSession.getSupportLevel().isBlank()) {
                        sessionSupportLevel = activeSession.getSupportLevel();
                    }
                    if (activeSession.getSuggestedTopics() != null) {
                        sessionSuggestedTopics = activeSession.getSuggestedTopics();
                    }
                } catch (RuntimeException sessionError) {
                    log.debug("Tutor session unavailable for intent context: {}", sessionError.getMessage());
                }
            }
            String routingMode = HarnessRouting.normalizeMode(request.getHarnessMode());
            IntentClassification intent;
            if (routingMode != null) {
                intent = buildHarnessIntent(request, routingMode);
            } else {
                String classifierHistory = aiConversationService.buildRecentTutorContextForClassifier(
                        request.getConversationId(), userId);
                intent = intentClassifierService.classify(
                        question,
                        codeSnippet,
                        courseId,
                        new TutorIntentContext(classifierHistory, sessionPhase, sessionTopic)
                );
                routingMode = intent.getMode();
            }
            String requestedMode = normalizeStudentRequestedMode(request.getRequestedMode());
            if (requestedMode != null && !IntentClassifierService.MODE_ESCALATE.equals(routingMode)) {
                routingMode = requestedMode;
                applyStudentRequestedMode(intent, requestedMode);
            }
            if (!persistTurn) {
                routingMode = IntentClassifierService.MODE_RAG;
            }
            if (isUnderstandingRemediation(question)) {
                routingMode = IntentClassifierService.MODE_RAG;
            }
            RagQueryIntent improvePlanIntent = improvePlanService.resolveReviewIntent(
                    userId,
                    courseId,
                    request.getImprovePlanId(),
                    request.getPlanItemId()
            );
            RagQueryIntent sourceBackedIntent = buildSourceBackedIntent(request, question);
            RagQueryIntent provenanceIntent = improvePlanIntent != null ? improvePlanIntent : sourceBackedIntent;
            if (provenanceIntent != null) {
                routingMode = IntentClassifierService.MODE_RAG;
                intent.setMode(IntentClassifierService.MODE_RAG);
                intent.setSubIntent("EXPLAIN_CONCEPT");
                intent.setRequiresCourseMaterial(true);
                intent.setRoutingStrategy(improvePlanIntent != null
                        ? "IMPROVE_PLAN_PROVENANCE"
                        : "SOURCE_BACKED_STUDY_TIP");
                if (improvePlanIntent != null
                        && improvePlanIntent.getLearningObjective() != null
                        && !improvePlanIntent.getLearningObjective().isBlank()) {
                    question = "Ôn tập theo Improve Plan: " + improvePlanIntent.getLearningObjective();
                }
            }
            log.info("Tutor routing decision: mode={}, harnessMode={}, subIntent={}, strategy={}, confidence={}, improvePlanId={}, planItemId={}",
                    routingMode, request.getHarnessMode(), intent.getSubIntent(),
                    intent.getRoutingStrategy(), intent.getConfidence(),
                    improvePlanIntent == null ? null : improvePlanIntent.getImprovePlanId(),
                    improvePlanIntent == null ? null : improvePlanIntent.getPlanItemId());

            if (IntentClassifierService.MODE_CODE.equals(routingMode)) {
                return handleCodeMentorIntent(request, question, courseId, classId, userId, intent);
            }

            if (IntentClassifierService.MODE_ESCALATE.equals(routingMode)) {
                return handleEscalationIntent(
                        request, question, courseId, classId, userId, userName, userEmail, intent);
            }

            String pedagogicalContext = pedagogicalDirectiveService.buildTutorContext(
                    userId, courseId, classId);
            String learnerContext = studentCourseMemoryService.buildTutorContext(userId, courseId);
            if (improvePlanIntent != null) {
                learnerContext = appendTutorContext(learnerContext, improvePlanContextBlock(improvePlanIntent));
            }
            if (!recentHistoryContext.isBlank()) {
                learnerContext = learnerContext.isBlank()
                        ? "- Recent session history:\n" + recentHistoryContext
                        : learnerContext + "\n- Recent session history:\n" + recentHistoryContext;
            }
            if (!persistTurn) {
                String checkHint = "- The student is checking their multiple-choice answer to the current lesson. "
                        + "Say whether the chosen option is correct, name the right option, and explain briefly from the material. "
                        + "Do not start a new learning path or ask them to send another chat message.";
                learnerContext = learnerContext.isBlank() ? checkHint : learnerContext + "\n" + checkHint;
            }
            if (persistTurn && "LEARNING_PATH".equals(intent.getSubIntent())) {
                String chapterHints = tutorSessionService.courseChapterTitleHints(courseId);
                if (!chapterHints.isBlank()) {
                    learnerContext = learnerContext.isBlank()
                            ? chapterHints
                            : learnerContext + "\n" + chapterHints;
                }
            }
            boolean conversationalInteraction = Boolean.FALSE.equals(intent.getRequiresCourseMaterial())
                    && ("CONVERSATIONAL".equals(intent.getSubIntent())
                    || "OFF_TOPIC".equals(intent.getSubIntent()));
            String teachingMode = persistTurn ? intent.getSubIntent() : "EXPLAIN_CONCEPT";
            if ("LESSON_TEACH".equalsIgnoreCase(teachingMode)
                    || "LESSON_DEEP_PATH".equalsIgnoreCase(teachingMode)) {
                pedagogicalContext = appendTutorContext(
                        pedagogicalContext,
                        supportLevelTutorContext(sessionSupportLevel)
                );
            }
            String pathContext = LearningPathParser.activePathContext(sessionSuggestedTopics);
            if (!pathContext.isBlank()
                    && ("LESSON_TEACH".equalsIgnoreCase(teachingMode)
                    || "LESSON_DEEP_PATH".equalsIgnoreCase(teachingMode))) {
                learnerContext = learnerContext.isBlank()
                        ? pathContext
                        : pathContext + "\n" + learnerContext;
            }
            String lastStudentQuestion = ConversationFocus.lastSubstantiveStudentQuestion(recentHistoryContext);
            String retrievalHint = null;
            if (StudentChatIntentDetector.isDependentFollowUp(question)) {
                retrievalHint = (lastStudentQuestion == null || lastStudentQuestion.isBlank())
                        ? sessionTopic
                        : lastStudentQuestion;
                if (!lastStudentQuestion.isBlank()) {
                    String followUpHint = "- The student is following up on their previous question. Stay on that topic; "
                            + "do not jump to a different chapter (for example Servlet Specification → JSP). "
                            + "Previous question: " + lastStudentQuestion;
                    learnerContext = learnerContext.isBlank()
                            ? followUpHint
                            : learnerContext + "\n" + followUpHint;
                }
            }
            CourseRagAnswer ragAnswer;
            if (conversationalInteraction) {
                ragAnswer = courseAnswerService.answerTutorInteraction(
                        question, courseId, intent.getSubIntent(),
                        pedagogicalContext, learnerContext, recentHistoryContext);
            } else if (provenanceIntent != null) {
                ragAnswer = courseAnswerService.askWithImprovePlanContext(
                        question, courseId, classId, pedagogicalContext, learnerContext, provenanceIntent);
            } else {
                ragAnswer = (pedagogicalContext.isBlank() && learnerContext.isBlank())
                        ? courseAnswerService.askWithConfidence(question, courseId, classId, teachingMode, retrievalHint)
                        : courseAnswerService.askWithPersonalizedTutorContext(
                                question, courseId, classId, pedagogicalContext, learnerContext,
                                teachingMode, retrievalHint);
            }
            String answer = ragAnswer.getAnswer();
            List<SuggestionItem> lessonSuggestions = LearningPathParser.parseLessonSuggestions(answer);

            QuestionEscalation questionEscalation = null;
            String conversationId = null;
            String userMessageId = null;
            String assistantMessageId = null;
            TutorSession tutorSessionState = null;

            if (persistTurn && userId != null && !userId.isBlank()) {
                if (courseId != null && !courseId.isBlank()) {
                    studentCourseMemoryService.recordInteraction(
                            userId,
                            courseId,
                            classId,
                            question,
                            answer
                    );
                }

                if (Boolean.TRUE.equals(ragAnswer.getEscalationRecommended())) {
                    questionEscalation = mentorEscalationService.createQuestionEscalation(
                            userId,
                            userEmail != null ? userEmail : "user@example.com",
                            userName != null ? userName : userId,
                            question,
                            answer,
                            courseId,
                            classId
                    );
                }

                var savedExchange = aiConversationService.saveExchangeWithMessages(
                        userId,
                        request.getConversationId(),
                        courseId,
                        classId,
                        question,
                        answer,
                        questionEscalation != null ? questionEscalation.getId() : null,
                        IntentClassifierService.MODE_RAG,
                        ragAnswer.getConfidence(),
                        ragAnswer.getSources(),
                        ragAnswer.getSourceEvidence(),
                        ragAnswer.getGroundingType()
                );
                conversationId = savedExchange.conversationId();
                userMessageId = savedExchange.userMessageId();
                assistantMessageId = savedExchange.assistantMessageId();
                if (request.getTutorSessionId() != null && !request.getTutorSessionId().isBlank()) {
                    aiConversationService.attachExchangeToTutorSession(
                            conversationId,
                            userMessageId,
                            assistantMessageId,
                            request.getTutorSessionId(),
                            request.getSessionPhase() == null ? "TEACH" : request.getSessionPhase()
                    );
                    tutorSessionState = tutorSessionService.recordStudentTurn(
                            request.getTutorSessionId(), conversationId);
                    if (!lessonSuggestions.isEmpty()
                            && "LEARNING_PATH".equalsIgnoreCase(intent.getSubIntent())) {
                        tutorSessionState = tutorSessionService.applyLearningPath(
                                request.getTutorSessionId(), question, lessonSuggestions);
                    }
                }
            }

            AiQueryResponse response = new AiQueryResponse();
            boolean escalated = questionEscalation != null;
            response.setMode(IntentClassifierService.MODE_RAG);
            response.setIntentReason(intent.getReason());
            response.setIntentConfidence(intent.getConfidence());
            applyIntentMetadata(response, intent);
            response.setAnswer(escalated ? ragAnswer.getAnswer() : answer);
            response.setConfidence(ragAnswer.getConfidence());
            response.setSources(ragAnswer.getSources());
            response.setSourceEvidence(ragAnswer.getSourceEvidence());
            response.setGroundingType(ragAnswer.getGroundingType());
            response.setEscalated(escalated);
            response.setEscalationReason(escalated ? ragAnswer.getEscalationReason() : null);
            response.setConversationId(conversationId != null && !conversationId.isBlank()
                    ? conversationId
                    : (request.getConversationId() == null ? "" : request.getConversationId()));
            response.setUserMessageId(userMessageId);
            response.setAssistantMessageId(assistantMessageId);
            response.setCourseId(courseId);
            response.setClickedSuggestion(request.getClickedSuggestion());
            response.setTutorSessionId(request.getTutorSessionId());
            response.setSessionPhase(tutorSessionState == null
                    ? (request.getSessionPhase() == null ? "TEACH" : request.getSessionPhase())
                    : tutorSessionState.getPhase());
            if (request.getTutorSessionId() != null && !request.getTutorSessionId().isBlank()) {
                response.setSupportLevel((tutorSessionState == null
                        ? tutorSessionService.getSession(request.getTutorSessionId())
                        : tutorSessionState).getSupportLevel());
            }
            if (questionEscalation != null) {
                response.setQuestionEscalationId(questionEscalation.getId());
            }
            if (persistTurn && !lessonSuggestions.isEmpty()
                    && "LEARNING_PATH".equalsIgnoreCase(intent.getSubIntent())) {
                response.setNextImproveSuggestions(lessonSuggestions);
            }
            if (tutorSessionState != null && tutorSessionState.getSuggestedTopics() != null) {
                response.setSuggestedTopics(tutorSessionState.getSuggestedTopics());
            }
            applyDailyQuota(response, userId, courseId);

            return ResponseEntity.ok(response);
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
            log.error("Unexpected error during AI query", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Server error: " + e.getMessage()));
        }
    }

    private void applyDailyQuota(AiQueryResponse response, String studentId, String courseId) {
        if (studentId == null || studentId.isBlank() || courseId == null || courseId.isBlank()) {
            return;
        }
        try {
            StudentDailyQuestionQuotaService.QuotaUsage usage = questionQuotaService.currentUsage(studentId, courseId);
            response.setDailyQuestionUsed(usage.used());
            response.setDailyQuestionLimit(questionQuotaService.dailyLimit());
            response.setDailyQuestionRemaining(usage.remaining());
        } catch (RuntimeException ignored) {
            // Quota readout must not fail the student answer.
        }
    }

    private boolean isStudent(Authentication authentication) {
        return authentication != null && authentication.getAuthorities().stream()
                .anyMatch(authority -> "ROLE_STUDENT".equals(authority.getAuthority()));
    }

    private TutorIntentContext resolveIntentContext(
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

    private void applyIntentMetadata(AiQueryResponse response, IntentClassification intent) {
        if (response == null || intent == null) {
            return;
        }
        response.setSubIntent(intent.getSubIntent());
        response.setDomain(intent.getDomain());
        response.setAnswerPolicy(intent.getAnswerPolicy());
        response.setRequiresCourseMaterial(intent.getRequiresCourseMaterial());
        response.setRoutingStrategy(intent.getRoutingStrategy());
    }

    private String normalizeStudentRequestedMode(String value) {
        String mode = HarnessRouting.normalizeMode(value);
        if (IntentClassifierService.MODE_RAG.equals(mode) || IntentClassifierService.MODE_CODE.equals(mode)) {
            return mode;
        }
        return null;
    }

    private void applyStudentRequestedMode(IntentClassification intent, String mode) {
        intent.setMode(mode);
        intent.setRoutingStrategy("STUDENT_SELECTED_MODE");
        if (IntentClassifierService.MODE_CODE.equals(mode)) {
            if (intent.getSubIntent() == null
                    || !intent.getSubIntent().matches("DEBUG_CODE|EXPLAIN_ERROR|CODE_REVIEW|ALGORITHM_HINT|DATA_STRUCTURE_ADVICE|SQL_REVIEW|ARCHITECTURE_REVIEW|REVIEW_LOGIC|GUIDE_SOLUTION|TECHNICAL_MENTORING")) {
                intent.setSubIntent("TECHNICAL_MENTORING");
            }
            intent.setRequiresCourseMaterial(false);
            intent.setAnswerPolicy("Guide, explain, review, or debug without completing assessed work.");
            return;
        }
        if (intent.getSubIntent() == null
                || intent.getSubIntent().matches("DEBUG_CODE|EXPLAIN_ERROR|CODE_REVIEW|ALGORITHM_HINT|DATA_STRUCTURE_ADVICE|SQL_REVIEW|ARCHITECTURE_REVIEW|REVIEW_LOGIC|GUIDE_SOLUTION|TECHNICAL_MENTORING")) {
            intent.setSubIntent("EXPLAIN_CONCEPT");
        }
        intent.setRequiresCourseMaterial(true);
        intent.setAnswerPolicy("Answer only from the currently selected course material; escalate when evidence is insufficient.");
    }

    private String appendTutorContext(String base, String extra) {
        if (extra == null || extra.isBlank()) {
            return base == null ? "" : base;
        }
        if (base == null || base.isBlank()) {
            return extra;
        }
        return base + "\n" + extra;
    }

    private String supportLevelTutorContext(String supportLevel) {
        String normalized = supportLevel == null ? "STANDARD" : supportLevel.trim().toUpperCase(Locale.ROOT);
        return switch (normalized) {
            case "HIGH_SUPPORT" -> """
                    - Active support level: HIGH_SUPPORT.
                      Teach in smaller steps, use simpler wording, and make the required understanding check
                      a direct recognition question with clearly distinct choices.
                    """.stripTrailing();
            case "CHALLENGE" -> """
                    - Active support level: CHALLENGE.
                      Reduce scaffolding, ask the student to reason from the material, and make the required
                      understanding check an application or comparison question without adding outside facts.
                    """.stripTrailing();
            default -> """
                    - Active support level: STANDARD.
                      Balance explanation and learner effort. Make the required understanding check a direct
                      application of the lesson, using only the supplied course material.
                    """.stripTrailing();
        };
    }

    private String improvePlanContextBlock(RagQueryIntent intent) {
        return """
                - Improve Plan review context:
                  learningObjective: %s
                  retrievalTerms: %s
                  sourceTerms: %s
                  sourceMaterialCount: %d
                  sourceChunkCount: %d
                  Use the source terms and linked chunks as the factual anchor. Do not search using tutoring meta-language.
                """.formatted(
                intent.getLearningObjective() == null ? "" : intent.getLearningObjective(),
                intent.getRetrievalTerms() == null ? List.of() : intent.getRetrievalTerms(),
                intent.getSourceTerms() == null ? List.of() : intent.getSourceTerms(),
                intent.getSourceMaterialIds() == null ? 0 : intent.getSourceMaterialIds().size(),
                intent.getSourceChunkIds() == null ? 0 : intent.getSourceChunkIds().size()
        ).stripTrailing();
    }

    private IntentClassification buildHarnessIntent(AiQueryRequest request, String mode) {
        String subIntent = normalizedHarnessValue(request.getHarnessSubIntent());
        if (subIntent == null) {
            subIntent = switch (mode) {
                case IntentClassifierService.MODE_CODE -> "TECHNICAL_MENTORING";
                case IntentClassifierService.MODE_ESCALATE -> "TEACHER_POLICY";
                default -> "EXPLAIN_CONCEPT";
            };
        }
        String domain = normalizedHarnessValue(request.getHarnessDomain());
        if (domain == null) {
            domain = "GENERAL_STUDY";
        }
        double confidence = request.getHarnessConfidence() == null
                ? 0.99
                : Math.max(0.0, Math.min(0.99, request.getHarnessConfidence()));
        boolean requiresCourseMaterial = IntentClassifierService.MODE_RAG.equals(mode)
                && !"CONVERSATIONAL".equals(subIntent)
                && !"OFF_TOPIC".equals(subIntent);
        String answerPolicy = switch (mode) {
            case IntentClassifierService.MODE_CODE ->
                    "Guide, explain, review, or debug without completing assessed work.";
            case IntentClassifierService.MODE_ESCALATE ->
                    "Create escalation. Do not answer teacher-only decisions.";
            default -> requiresCourseMaterial
                    ? "Answer from course materials and approved knowledge; escalate when evidence is insufficient."
                    : "Respond naturally as a course tutor without inventing course facts.";
        };
        String reason = request.getHarnessReason() == null || request.getHarnessReason().isBlank()
                ? "n8n AI Harness selected the backend route"
                : request.getHarnessReason().trim();
        return IntentClassification.builder()
                .mode(mode)
                .reason(reason)
                .confidence(confidence)
                .subIntent(subIntent)
                .domain(domain)
                .answerPolicy(answerPolicy)
                .requiresCourseMaterial(requiresCourseMaterial)
                .routingStrategy("N8N_HARNESS")
                .build();
    }

    private String normalizedHarnessValue(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        String normalized = value.trim().toUpperCase();
        return normalized.matches("[A-Z][A-Z0-9_]{0,63}") ? normalized : null;
    }

    private ResponseEntity<?> handleCodeMentorIntent(
            AiQueryRequest request,
            String question,
            String courseId,
            String classId,
            String userId,
            IntentClassification intent
    ) {
        CodeMentorRequest codeRequest = new CodeMentorRequest();
        codeRequest.setStudentId(userId);
        codeRequest.setCourseId(courseId);
        codeRequest.setClassId(classId);
        codeRequest.setQuestion(question);
        codeRequest.setCode(request.getCodeSnippet());
        codeRequest.setConversationId(request.getConversationId());

        var codeResponse = codeMentorService.mentor(codeRequest);

        AiQueryResponse response = new AiQueryResponse();
        response.setMode(IntentClassifierService.MODE_CODE);
        response.setIntentReason(intent.getReason());
        response.setIntentConfidence(intent.getConfidence());
        applyIntentMetadata(response, intent);
        response.setAnswer(codeResponse.getAnswer());
        response.setConfidence(intent.getConfidence());
        response.setEscalated(false);
        response.setConversationId(codeResponse.getConversationId());
        response.setUserMessageId(codeResponse.getUserMessageId());
        response.setAssistantMessageId(codeResponse.getAssistantMessageId());
        response.setSources(List.of("CODE"));
        response.setSourceEvidence(List.of());
        response.setGroundingType(codeResponse.getGroundingType());
        response.setCourseId(courseId);
        attachTutorSessionContext(
                response,
                request,
                codeResponse.getConversationId(),
                codeResponse.getUserMessageId(),
                codeResponse.getAssistantMessageId()
        );
        return ResponseEntity.ok(response);
    }

    private ResponseEntity<?> handleEscalationIntent(
            AiQueryRequest request,
            String question,
            String courseId,
            String classId,
            String userId,
            String userName,
            String userEmail,
            IntentClassification intent
    ) {
        QuestionEscalation questionEscalation = null;
        if (userId != null && !userId.isBlank()) {
            questionEscalation = mentorEscalationService.createQuestionEscalation(
                    userId,
                    userEmail != null ? userEmail : "user@example.com",
                    userName != null ? userName : userId,
                    question,
                    "Intent classifier routed this question directly to teacher escalation.",
                    courseId,
                    classId
            );
        }

        AiQueryResponse response = new AiQueryResponse();
        response.setMode(IntentClassifierService.MODE_ESCALATE);
        response.setIntentReason(intent.getReason());
        response.setIntentConfidence(intent.getConfidence());
        applyIntentMetadata(response, intent);
        response.setAnswer(questionEscalation != null
                ? "Câu hỏi đã được gửi cho giáo viên/mentor phụ trách."
                : "Câu hỏi này cần giáo viên/mentor hỗ trợ. Vui lòng đăng nhập để tạo phiếu escalation.");
        response.setConfidence(intent.getConfidence());
        response.setEscalated(questionEscalation != null);
        response.setEscalationReason(intent.getReason());
        response.setQuestionEscalationId(questionEscalation != null ? questionEscalation.getId() : null);
        response.setSources(List.of());
        response.setSourceEvidence(List.of());
        response.setGroundingType("NONE");
        response.setCourseId(courseId);
        if (userId != null && !userId.isBlank()) {
            var savedExchange = aiConversationService.saveExchangeWithMessages(
                    userId,
                    request.getConversationId(),
                    courseId,
                    classId,
                    question,
                    response.getAnswer(),
                    questionEscalation != null ? questionEscalation.getId() : null,
                    IntentClassifierService.MODE_ESCALATE,
                    intent.getConfidence(),
                    List.of(),
                    List.of(),
                    "NONE"
            );
            response.setConversationId(savedExchange.conversationId());
            response.setUserMessageId(savedExchange.userMessageId());
            response.setAssistantMessageId(savedExchange.assistantMessageId());
            attachTutorSessionContext(
                    response,
                    request,
                    savedExchange.conversationId(),
                    savedExchange.userMessageId(),
                    savedExchange.assistantMessageId()
            );
        }
        applyDailyQuota(response, userId, courseId);
        return ResponseEntity.ok(response);
    }

    private void attachTutorSessionContext(
            AiQueryResponse response,
            AiQueryRequest request,
            String conversationId,
            String userMessageId,
            String assistantMessageId
    ) {
        String sessionId = request.getTutorSessionId();
        if (sessionId == null || sessionId.isBlank()) {
            return;
        }
        String phase = request.getSessionPhase() == null ? "TEACH" : request.getSessionPhase();
        TutorSession session = null;
        if (conversationId != null && userMessageId != null && assistantMessageId != null) {
            aiConversationService.attachExchangeToTutorSession(
                    conversationId, userMessageId, assistantMessageId, sessionId, phase);
            session = tutorSessionService.recordStudentTurn(sessionId, conversationId);
        }
        if (session == null) {
            session = tutorSessionService.getSession(sessionId);
        }
        response.setTutorSessionId(sessionId);
        response.setSessionPhase(session.getPhase() == null ? phase : session.getPhase());
        response.setSupportLevel(session.getSupportLevel());
    }

    private String resolveQuestion(AiQueryRequest request) {
        if (request.getMessage() != null && !request.getMessage().isBlank()) {
            return request.getMessage();
        }
        return request.getQuestion();
    }

    private String normalizeScopeValue(String value) {
        return value != null && !value.isBlank() ? value.trim() : null;
    }

    private String normalizeStudentQuestion(String question) {
        return questionNormalizationService.normalize(question);
    }

    private RagQueryIntent buildSourceBackedIntent(AiQueryRequest request, String question) {
        if (request == null
                || !"SOURCE_BACKED_STUDY_TIP".equalsIgnoreCase(request.getInteractionType())) {
            return null;
        }
        List<String> materialIds = cleanProvenanceIds(request.getSourceMaterialIds());
        if (materialIds.isEmpty()) {
            return null;
        }
        String clickedSuggestion = request.getClickedSuggestion() == null
                ? question
                : request.getClickedSuggestion().trim();
        return RagQueryIntent.builder()
                .learningObjective(clickedSuggestion)
                .retrievalQuery(clickedSuggestion)
                .retrievalTerms(List.of(clickedSuggestion))
                .teachingMode("EXPLAIN_CONCEPT")
                .sourceMaterialIds(materialIds)
                .sourceChunkIds(cleanProvenanceIds(request.getSourceChunkIds()))
                .sourceTerms(List.of(clickedSuggestion))
                .build();
    }

    private List<String> cleanProvenanceIds(List<String> values) {
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

    private boolean isUnderstandingRemediation(String question) {
        return question != null
                && question.stripLeading().startsWith("Ôn lại sau câu ");
    }
}
