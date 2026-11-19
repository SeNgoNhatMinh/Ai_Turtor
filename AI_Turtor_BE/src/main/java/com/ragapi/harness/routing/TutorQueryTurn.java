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
import com.ragapi.harness.directive.PedagogicalDirectiveService;
import com.ragapi.service.student.StudentDailyQuestionQuotaService;
import com.ragapi.harness.answer.generation.SupportLevelPrompt;
import com.ragapi.harness.behavior.plan.StudentLearningContext;
import com.ragapi.harness.behavior.plan.TeachingPlan;
import com.ragapi.harness.entity.QuestionEscalation;
import com.ragapi.harness.entity.TutorSession;
import com.ragapi.harness.learning.LearningPathGroundingService;
import com.ragapi.harness.util.ChapterHeadingUtils;
import com.ragapi.harness.util.ConversationFocus;
import com.ragapi.harness.util.HarnessRouting;
import com.ragapi.harness.util.LearningPathParser;
import com.ragapi.harness.util.StudentChatIntentDetector;
import com.ragapi.harness.util.StudentFacingMessages;
import jakarta.servlet.http.HttpServletRequest;
import java.io.IOException;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

/** One student turn: choose the route, write the answer, then save it. */
@Slf4j
class TutorQueryTurn {

    static boolean embedsTeachingBehavior(
            boolean refuseWorker,
            boolean learningPathOnly,
            boolean guidedLesson,
            boolean chapterInMemory
    ) {
        return !refuseWorker && !learningPathOnly && !guidedLesson && !chapterInMemory;
    }


    final TutorQueryService queries;
    boolean quotaCharged;
    String generationTraceId = "";

    TutorQueryTurn(TutorQueryService queries) {
        this.queries = queries;
    }

    ResponseEntity<?> run(
            AiQueryRequest request,
            String userId,
            String userName,
            String userEmail,
            Authentication authentication,
            HttpServletRequest httpRequest
    ) throws IOException {
            if (request == null) {
                return ResponseEntity.badRequest().body(Map.of("error", "request body is required"));
            }
            TurnState state = new TurnState();
            state.userId = userId;
            ResponseEntity<?> routed = prepareQuestion(
                    state, request, userName, userEmail, authentication, httpRequest);
            if (routed != null) {
                return routed;
            }
            chooseAnswer(state, request);
            return saveTurn(state, request, userName, userEmail);
    }

    void applyGroundedLearningPath(
            CourseRagAnswer ragAnswer,
            List<SuggestionItem> lessons,
            String supportLevel
    ) {
        if (lessons == null || lessons.isEmpty()) {
            ragAnswer.setAnswer(StudentFacingMessages.noMatchingStudyUnit());
            ragAnswer.setSources(List.of());
            ragAnswer.setSourceEvidence(List.of());
            ragAnswer.setGroundingType("NONE");
            return;
        }
        ragAnswer.setAnswer(queries.learningPathGroundingService.pathAnswer(lessons, supportLevel));
        Set<String> materialIds = new LinkedHashSet<>();
        for (SuggestionItem lesson : lessons) {
            if (lesson.getSourceMaterialIds() != null) {
                materialIds.addAll(lesson.getSourceMaterialIds());
            }
        }
        List<RagSourceEvidence> evidence = queries.learningPathGroundingService.citedEvidence(
                        lessons,
                        ragAnswer.getSourceEvidence()
                ).stream()
                .filter(item -> item.getMaterialId() != null && materialIds.contains(item.getMaterialId()))
                .map(TutorQueryTurn::withoutInternalKnowledgeLabel)
                .toList();
        ragAnswer.setSourceEvidence(evidence);
        if (evidence.isEmpty()) {
            ragAnswer.setSources(lessons.stream()
                    .map(SuggestionItem::getChapterTitle)
                    .filter(title -> title != null && !title.isBlank())
                    .map(ChapterHeadingUtils::studentFacingTitle)
                    .distinct()
                    .toList());
            return;
        }
        ragAnswer.setSources(evidence.stream()
                .map(item -> {
                    String title = item.getMaterialTitle() == null || item.getMaterialTitle().isBlank()
                            ? item.getChapter()
                            : item.getMaterialTitle();
                    return ChapterHeadingUtils.studentFacingTitle(title);
                })
                .filter(title -> title != null && !title.isBlank())
                .distinct()
                .toList());
    }

    static RagSourceEvidence withoutInternalKnowledgeLabel(RagSourceEvidence item) {
        item.setMaterialTitle(ChapterHeadingUtils.studentFacingTitle(item.getMaterialTitle()));
        item.setChapter(ChapterHeadingUtils.studentFacingTitle(item.getChapter()));
        return item;
    }

    void applyDailyQuota(AiQueryResponse response, String studentId, String courseId) {
        if (studentId == null || studentId.isBlank() || courseId == null || courseId.isBlank()) {
            return;
        }
        try {
            StudentDailyQuestionQuotaService.QuotaUsage usage = queries.questionQuotaService.currentUsage(studentId, courseId);
            response.setDailyQuestionUsed(usage.used());
            response.setDailyQuestionLimit(queries.questionQuotaService.dailyLimit());
            response.setDailyQuestionRemaining(usage.remaining());
        } catch (RuntimeException ignored) {
            // Quota readout must not fail the student answer.
        }
    }

    void applyIntentMetadata(AiQueryResponse response, IntentClassification intent) {
        if (response == null || intent == null) {
            return;
        }
        response.setSubIntent(intent.getSubIntent());
        response.setDomain(intent.getDomain());
        response.setAnswerPolicy(intent.getAnswerPolicy());
        response.setRequiresCourseMaterial(intent.getRequiresCourseMaterial());
        response.setRoutingStrategy(intent.getRoutingStrategy());
    }

    void logRouteDecision(
            String courseId,
            String conversationId,
            String studentId,
            IntentClassification intent,
            String worker,
            long startedNanos
    ) {
        try {
            long latencyMs = Math.max(0L, (System.nanoTime() - startedNanos) / 1_000_000L);
            HarnessLogRequest logRequest = new HarnessLogRequest();
            logRequest.setTraceId(currentTraceId());
            logRequest.setConversationId(conversationId);
            logRequest.setStudentId(studentId);
            logRequest.setCourseId(courseId);
            logRequest.setWorkflowName("Student Chat Harness");
            logRequest.setNodeName("Harness Router");
            logRequest.setMode(worker);
            logRequest.setEventType("ROUTE_DECIDED");
            logRequest.setStatus("SUCCESS");
            Map<String, Object> metadata = new LinkedHashMap<>();
            metadata.put("worker", worker == null ? "" : worker);
            metadata.put("strategy", intent == null || intent.getRoutingStrategy() == null ? "" : intent.getRoutingStrategy());
            metadata.put("subIntent", intent == null || intent.getSubIntent() == null ? "" : intent.getSubIntent());
            metadata.put("latencyMs", latencyMs);
            logRequest.setMetadata(metadata);
            queries.harnessLogService.createLog(logRequest);
        } catch (RuntimeException error) {
            log.warn("Harness route log skipped: {}", error.getMessage());
        }
    }

    String currentTraceId() {
        var attributes = RequestContextHolder.getRequestAttributes();
        if (attributes instanceof ServletRequestAttributes servletAttributes) {
            String header = servletAttributes.getRequest().getHeader("X-Trace-Id");
            if (header != null && !header.isBlank()) {
                return header.trim();
            }
        }
        return UUID.randomUUID().toString();
    }

    String appendTutorContext(String base, String extra) {
        if (extra == null || extra.isBlank()) {
            return base == null ? "" : base;
        }
        if (base == null || base.isBlank()) {
            return extra;
        }
        return base + "\n" + extra;
    }

    String learningPathSupportContext(String supportLevel) {
        String normalized = supportLevel == null ? "STANDARD" : supportLevel.trim().toUpperCase(Locale.ROOT);
        int count = LearningPathGroundingService.lessonCountForSupportLevel(normalized);
        return switch (normalized) {
            case "HIGH_SUPPORT" -> """
                    - Learning path for HIGH_SUPPORT: use at most %d real chapter titles from COURSE MATERIAL CONTEXT, in textbook order.
                      Split the topic into small steps. Do not invent a chapter that is not in the material.
                    """.formatted(count).stripTrailing();
            case "CHALLENGE" -> """
                    - Learning path for CHALLENGE: use at most %d real chapter titles that best match the question.
                      Do not add easier filler chapters. Do not invent a chapter that is not in the material.
                    """.formatted(count).stripTrailing();
            default -> """
                    - Learning path for STANDARD: use at most %d real chapter titles from the course material, in textbook order.
                      Do not invent a chapter that is not in the material.
                    """.formatted(count).stripTrailing();
        };
    }

    String supportLevelTutorContext(String supportLevel) {
        return SupportLevelPrompt.from(supportLevel).activeLevelReminder();
    }

    String improvePlanContextBlock(RagQueryIntent intent) {
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

    IntentClassification buildHarnessIntent(AiQueryRequest request, String mode) {
        String subIntent = normalizedHarnessValue(request.getHarnessSubIntent());
        if (subIntent == null) {
            subIntent = switch (mode) {
                case IntentClassifierService.MODE_CODE -> "TECHNICAL_MENTORING";
                case IntentClassifierService.MODE_ESCALATE -> "TEACHER_POLICY";
                case IntentClassifierService.MODE_REFUSE -> "OFF_TOPIC";
                case IntentClassifierService.MODE_CURRICULUM -> IntentClassifierService.MODE_CURRICULUM;
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
                && !"OFF_TOPIC".equals(subIntent)
                && !IntentClassifierService.MODE_CURRICULUM.equals(subIntent);
        String answerPolicy = switch (mode) {
            case IntentClassifierService.MODE_CODE ->
                    "Guide, explain, review, or debug without completing assessed work.";
            case IntentClassifierService.MODE_ESCALATE ->
                    "Create escalation. Do not answer teacher-only decisions.";
            case IntentClassifierService.MODE_REFUSE ->
                    "Refuse non-academic chat. Ask for a course question instead.";
            case IntentClassifierService.MODE_CURRICULUM ->
                    "Greet the student and show the official course curriculum, not book headings.";
            default -> requiresCourseMaterial
                    ? "Answer from course materials and approved knowledge; escalate when evidence is insufficient."
                    : "Respond naturally as a course tutor without inventing course facts.";
        };
        String reason = request.getHarnessReason() == null || request.getHarnessReason().isBlank()
                ? "n8n AI Harness selected the backend route"
                : request.getHarnessReason().trim();
        String strategy = normalizedHarnessValue(request.getHarnessRoutingStrategy());
        return IntentClassification.builder()
                .mode(mode)
                .reason(reason)
                .confidence(confidence)
                .subIntent(subIntent)
                .domain(domain)
                .answerPolicy(answerPolicy)
                .requiresCourseMaterial(requiresCourseMaterial)
                .routingStrategy(strategy == null ? "N8N_HARNESS" : strategy)
                .build();
    }

    String normalizedHarnessValue(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        String normalized = value.trim().toUpperCase();
        return normalized.matches("[A-Z][A-Z0-9_]{0,63}") ? normalized : null;
    }

    ResponseEntity<?> handleCodeMentorIntent(
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

        queries.generationGate.checkpoint();
        var codeResponse = queries.codeMentorService.mentor(codeRequest);
        queries.generationGate.checkpoint();

        AiQueryResponse response = new AiQueryResponse();
        response.setMode(IntentClassifierService.MODE_CODE);
        response.setIntentReason(intent.getReason());
        response.setIntentConfidence(intent.getConfidence());
        applyIntentMetadata(response, intent);
        response.setAnswer(codeResponse.getAnswer());
        response.setOutcome(StudentFacingMessages.isUnavailableMessage(codeResponse.getAnswer())
                ? "AI_UNAVAILABLE" : "ANSWERED");
        response.setConfidence(intent.getConfidence());
        response.setEscalated(false);
        response.setConversationId(codeResponse.getConversationId());
        response.setUserMessageId(codeResponse.getUserMessageId());
        response.setAssistantMessageId(codeResponse.getAssistantMessageId());
        response.setSources(List.of("CODE"));
        response.setSourceEvidence(List.of());
        response.setGroundingType(codeResponse.getGroundingType());
        response.setCourseId(courseId);
        response.setSupportLevel(codeResponse.getSupportLevel());
        attachTutorSessionContext(
                response,
                request,
                codeResponse.getConversationId(),
                codeResponse.getUserMessageId(),
                codeResponse.getAssistantMessageId()
        );
        return ResponseEntity.ok(response);
    }

    ResponseEntity<?> handleEscalationIntent(
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
            questionEscalation = queries.mentorEscalationService.createQuestionEscalation(
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
        response.setOutcome("NEEDS_MENTOR");
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
        response.setSupportLevel(queries.pedagogicalDirectiveService.resolveSupportLevel(userId, courseId, classId));
        if (userId != null && !userId.isBlank()) {
            var savedExchange = queries.aiConversationService.saveExchangeWithMessages(
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

    void attachTutorSessionContext(
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
            queries.aiConversationService.attachExchangeToTutorSession(
                    conversationId, userMessageId, assistantMessageId, sessionId, phase);
            session = queries.tutorSessionService.recordStudentTurn(sessionId, conversationId);
        }
        if (session == null) {
            session = queries.tutorSessionService.getSession(sessionId);
        }
        response.setTutorSessionId(sessionId);
        response.setSessionPhase(session.getPhase() == null ? phase : session.getPhase());
        response.setSupportLevel(queries.pedagogicalDirectiveService.resolveSupportLevel(
                session.getStudentId(), request.getCourseId(), request.getClassId()));
    }

    private ResponseEntity<?> prepareQuestion(
            TurnState state,
            AiQueryRequest request,
            String userName,
            String userEmail,
            Authentication authentication,
            HttpServletRequest httpRequest
    ) {
            if (request == null) {
                return ResponseEntity.badRequest().body(Map.of("error", "request body is required"));
            }
            if (queries.isStudent(authentication)) {
                state.userId = authentication.getName();
            }
            generationTraceId = queries.resolveGenerationTraceId(request, httpRequest);
            queries.generationGate.bind(generationTraceId, state.userId);
            state.question = queries.normalizeStudentQuestion(
                    requireMaxLength(queries.resolveQuestion(request), "state.question", STUDENT_QUESTION_MAX_LENGTH)
            );
            String codeSnippet = optionalCodeSnippet(request.getCodeSnippet(), "codeSnippet");
            state.courseId = requireText(request.getCourseId(), "state.courseId");
            state.classId = queries.normalizeScopeValue(request.getClassId());
            // Support level only — teaching behaviors are resolved after final state.intent routing.
            state.tutorGuidance =
                    queries.pedagogicalDirectiveService.resolveTutorGuidance(state.userId, state.courseId, state.classId);
            state.canonicalSupportLevel = state.tutorGuidance.supportLevel();
            state.persistTurn = !Boolean.FALSE.equals(request.getPersist());
            if (queries.isStudent(authentication) && state.persistTurn && !Boolean.TRUE.equals(request.getQuotaConsumed())) {
                queries.questionQuotaService.consume(authentication.getName(), state.courseId);
                quotaCharged = true;
            }
            state.recentHistoryContext = "";
            try {
                state.recentHistoryContext = queries.aiConversationService.buildRecentTutorContext(
                        request.getConversationId(), state.userId);
            } catch (RuntimeException historyError) {
                log.warn("Tutor history unavailable; continuing without chat context: {}", historyError.getMessage());
            }
            state.sessionTopic = null;
            state.sessionPhase = request.getSessionPhase();
            state.sessionSupportLevel = state.canonicalSupportLevel;
            state.sessionSuggestedTopics = List.of();
            if (request.getTutorSessionId() != null && !request.getTutorSessionId().isBlank()) {
                try {
                    TutorSession activeSession = queries.tutorSessionService.synchronizeTeacherControlledSupport(
                            request.getTutorSessionId(), state.classId, state.canonicalSupportLevel);
                    state.sessionTopic = activeSession.getTopic();
                    if (activeSession.getPhase() != null && !activeSession.getPhase().isBlank()) {
                        state.sessionPhase = activeSession.getPhase();
                    }
                    if (activeSession.getSuggestedTopics() != null) {
                        state.sessionSuggestedTopics = activeSession.getSuggestedTopics();
                    }
                } catch (RuntimeException sessionError) {
                    log.debug("Tutor session unavailable for state.intent context: {}", sessionError.getMessage());
                }
            }
            long routeStarted = System.nanoTime();
            state.routingMode = HarnessRouting.normalizeMode(request.getHarnessMode());
            if (state.routingMode != null) {
                state.intent = buildHarnessIntent(request, state.routingMode);
            } else {
                String classifierHistory = queries.aiConversationService.buildRecentTutorContextForClassifier(
                        request.getConversationId(), state.userId);
                state.intent = queries.classifyStudentIntent(
                        state.question,
                        codeSnippet,
                        state.courseId,
                        new TutorIntentContext(classifierHistory, state.sessionPhase, state.sessionTopic)
                );
                state.routingMode = state.intent.getMode();
            }
            boolean workerLocked = IntentClassifierService.MODE_REFUSE.equals(state.routingMode)
                    || IntentClassifierService.MODE_CURRICULUM.equals(state.routingMode);
            if (!workerLocked && !state.persistTurn) {
                state.routingMode = IntentClassifierService.MODE_RAG;
            }
            if (!workerLocked && queries.isUnderstandingRemediation(state.question)) {
                state.routingMode = IntentClassifierService.MODE_RAG;
            }
            state.guidedLesson = request != null
                    && "GUIDED_LESSON".equalsIgnoreCase(request.getInteractionType());
            if (!workerLocked && state.guidedLesson) {
                state.routingMode = IntentClassifierService.MODE_RAG;
                state.intent.setMode(IntentClassifierService.MODE_RAG);
                state.intent.setSubIntent("LESSON_TEACH");
                state.intent.setRequiresCourseMaterial(true);
                state.intent.setRoutingStrategy("GUIDED_LESSON");
            }
            state.improvePlanIntent = queries.improvePlanService.resolveReviewIntent(
                    state.userId,
                    state.courseId,
                    request.getImprovePlanId(),
                    request.getPlanItemId()
            );
            RagQueryIntent remediationIntent = queries.buildUnderstandingRemediationIntent(request, state.userId, state.question);
            RagQueryIntent sourceBackedIntent = remediationIntent != null
                    ? remediationIntent
                    : queries.buildSourceBackedIntent(request, state.question);
            state.provenanceIntent = state.improvePlanIntent != null ? state.improvePlanIntent : sourceBackedIntent;
            if (!workerLocked && state.provenanceIntent != null) {
                state.routingMode = IntentClassifierService.MODE_RAG;
                state.intent.setMode(IntentClassifierService.MODE_RAG);
                state.intent.setSubIntent(state.guidedLesson ? "LESSON_TEACH" : "EXPLAIN_CONCEPT");
                state.intent.setRequiresCourseMaterial(true);
                state.intent.setRoutingStrategy(state.improvePlanIntent != null
                        ? "IMPROVE_PLAN_PROVENANCE"
                        : (state.guidedLesson ? "GUIDED_LESSON_PROVENANCE" : "SOURCE_BACKED_STUDY_TIP"));
                if (state.improvePlanIntent != null
                        && state.improvePlanIntent.getLearningObjective() != null
                        && !state.improvePlanIntent.getLearningObjective().isBlank()) {
                    state.question = "Ôn tập theo Improve Plan: " + state.improvePlanIntent.getLearningObjective();
                }
            }
            if (!workerLocked && StudentChatIntentDetector.isLessonStart(state.question)) {
                state.routingMode = IntentClassifierService.MODE_RAG;
                state.intent.setMode(IntentClassifierService.MODE_RAG);
                state.intent.setSubIntent("LESSON_TEACH");
                state.intent.setRequiresCourseMaterial(true);
                if (!"GUIDED_LESSON".equals(state.intent.getRoutingStrategy())
                        && !"GUIDED_LESSON_PROVENANCE".equals(state.intent.getRoutingStrategy())) {
                    state.intent.setRoutingStrategy("GUIDED_LESSON");
                }
            }
            log.info("Tutor routing decision: worker={}, harnessMode={}, subIntent={}, strategy={}, confidence={}, improvePlanId={}, planItemId={}",
                    state.routingMode, request.getHarnessMode(), state.intent.getSubIntent(),
                    state.intent.getRoutingStrategy(), state.intent.getConfidence(),
                    state.improvePlanIntent == null ? null : state.improvePlanIntent.getImprovePlanId(),
                    state.improvePlanIntent == null ? null : state.improvePlanIntent.getPlanItemId());
            logRouteDecision(state.courseId, request.getConversationId(), state.userId, state.intent, state.routingMode, routeStarted);

            if (IntentClassifierService.MODE_CODE.equals(state.routingMode)) {
                return handleCodeMentorIntent(request, state.question, state.courseId, state.classId, state.userId, state.intent);
            }

            if (IntentClassifierService.MODE_ESCALATE.equals(state.routingMode)) {
                return handleEscalationIntent(
                        request, state.question, state.courseId, state.classId, state.userId, userName, userEmail, state.intent);
            }

        return null;
    }

    private void chooseAnswer(TurnState state, AiQueryRequest request) throws IOException {
            state.pedagogicalContext = state.tutorGuidance.tutorContext();
            String understandingSignals = "";
            try {
                understandingSignals = queries.aiConversationService.buildRecentUnderstandingSignals(
                        request.getConversationId(), state.userId);
            } catch (RuntimeException signalError) {
                log.warn("Understanding-check signals unavailable; continuing without them: {}",
                        signalError.getMessage());
            }
            StudentLearningContext learningContext = queries.studentLearningContextService.resolve(
                    state.userId,
                    state.courseId,
                    state.classId,
                    state.question,
                    state.sessionTopic,
                    state.recentHistoryContext,
                    understandingSignals
            );
            String learnerContext = learningContext.promptBlock();
            // Keep a short memory fallback when structured context is empty but course memory exists.
            if (learnerContext.isBlank()) {
                learnerContext = queries.studentCourseMemoryService.buildTutorContext(state.userId, state.courseId);
            }
            if (state.improvePlanIntent != null) {
                learnerContext = appendTutorContext(learnerContext, improvePlanContextBlock(state.improvePlanIntent));
            }
            if (!state.recentHistoryContext.isBlank()) {
                learnerContext = learnerContext.isBlank()
                        ? "- Recent session history:\n" + state.recentHistoryContext
                        : learnerContext + "\n- Recent session history:\n" + state.recentHistoryContext;
            }
            if (!understandingSignals.isBlank()) {
                String block = "- Recent understanding-check results in this conversation (oldest first):\n"
                        + understandingSignals;
                learnerContext = learnerContext.isBlank() ? block : learnerContext + "\n" + block;
            }
            if (!state.persistTurn) {
                String checkHint = "- The student is checking their multiple-choice state.answer to the current lesson. "
                        + "Say whether the chosen option is correct, name the right option, and explain briefly from the material. "
                        + "Do not start a new learning path or ask them to send another chat message.";
                learnerContext = learnerContext.isBlank() ? checkHint : learnerContext + "\n" + checkHint;
            }
            if (state.persistTurn && "LEARNING_PATH".equals(state.intent.getSubIntent())) {
                String chapterHints = queries.tutorSessionService.courseChapterTitleHints(state.courseId);
                if (!chapterHints.isBlank()) {
                    learnerContext = learnerContext.isBlank()
                            ? chapterHints
                            : learnerContext + "\n" + chapterHints;
                }
            }
            boolean refuseWorker = IntentClassifierService.MODE_REFUSE.equals(state.routingMode)
                    || (Boolean.FALSE.equals(state.intent.getRequiresCourseMaterial())
                    && ("CONVERSATIONAL".equals(state.intent.getSubIntent())
                    || "OFF_TOPIC".equals(state.intent.getSubIntent())));
            String teachingMode = state.persistTurn ? state.intent.getSubIntent() : "EXPLAIN_CONCEPT";
            boolean learningPathOnly = "LEARNING_PATH".equalsIgnoreCase(teachingMode)
                    || StudentChatIntentDetector.isTopiclessStudyRequest(state.question);
            TeachingPlan teachingPlan = null;
            boolean chapterInMemory = queries.chapterExcerptCache != null
                    && queries.chapterExcerptCache.match(state.courseId, state.question).isPresent();
            if (chapterInMemory && embedsTeachingBehavior(refuseWorker, learningPathOnly, state.guidedLesson, false)) {
                log.info("Skipping teaching-behavior embedding; indexed chapter is already in memory (courseId={})",
                        state.courseId);
            }
            if (embedsTeachingBehavior(refuseWorker, learningPathOnly, state.guidedLesson, chapterInMemory)) {
                String domain = state.intent.getDomain() != null && !state.intent.getDomain().isBlank()
                        ? state.intent.getDomain()
                        : request.getHarnessDomain();
                teachingPlan = queries.teachingOrchestrator.resolvePlan(
                        state.userId, state.courseId, state.classId, state.question, domain, teachingMode, state.sessionSupportLevel);
                String planBlock = queries.teachingOrchestrator.promptBlock(teachingPlan);
                if (!planBlock.isBlank()) {
                    // Style rules first so a long support-level note cannot push them out.
                    state.pedagogicalContext = state.pedagogicalContext.isBlank()
                            ? planBlock
                            : planBlock + "\n" + state.pedagogicalContext;
                }
            }
            if ("LEARNING_PATH".equalsIgnoreCase(teachingMode)) {
                state.pedagogicalContext = appendTutorContext(
                        state.pedagogicalContext,
                        learningPathSupportContext(state.sessionSupportLevel)
                );
            }
            // When a TeachingPlan prompt block already carries ACTIVE SUPPORT LEVEL, do not paste again.
            if (teachingPlan == null
                    && ("LESSON_TEACH".equalsIgnoreCase(teachingMode)
                    || "LESSON_DEEP_PATH".equalsIgnoreCase(teachingMode)
                    || !"STANDARD".equalsIgnoreCase(state.sessionSupportLevel))) {
                state.pedagogicalContext = appendTutorContext(
                        state.pedagogicalContext,
                        supportLevelTutorContext(state.sessionSupportLevel)
                );
            }
            if (state.guidedLesson) {
                state.pedagogicalContext = appendTutorContext(
                        state.pedagogicalContext,
                        "- Act as the student's responsible course teacher and personal tutor. "
                                + "Open the selected source chapter, explain its main idea step by step, "
                                + "use an example supported by that chapter, and check understanding. "
                                + "Do not replace the selected chapter with a merely similar search result."
                );
            }
            String pathContext = LearningPathParser.activePathContext(state.sessionSuggestedTopics);
            if (!pathContext.isBlank()
                    && ("LESSON_TEACH".equalsIgnoreCase(teachingMode)
                    || "LESSON_DEEP_PATH".equalsIgnoreCase(teachingMode))) {
                learnerContext = learnerContext.isBlank()
                        ? pathContext
                        : pathContext + "\n" + learnerContext;
            }
            String lastStudentQuestion = ConversationFocus.lastSubstantiveStudentQuestion(state.recentHistoryContext);
            String retrievalHint = null;
            if (StudentChatIntentDetector.isDependentFollowUp(state.question)) {
                retrievalHint = (lastStudentQuestion == null || lastStudentQuestion.isBlank())
                        ? state.sessionTopic
                        : lastStudentQuestion;
                if (!lastStudentQuestion.isBlank()) {
                    String followUpHint = "- The student is following up on their previous state.question. Stay on that topic; "
                            + "do not jump to a different chapter (for example Servlet Specification → JSP). "
                            + "Previous state.question: " + lastStudentQuestion;
                    learnerContext = learnerContext.isBlank()
                            ? followUpHint
                            : learnerContext + "\n" + followUpHint;
                }
            }
            boolean courseGreeting = IntentClassifierService.MODE_CURRICULUM.equals(state.routingMode);
            if (courseGreeting) {
                state.intent.setMode(IntentClassifierService.MODE_CURRICULUM);
                state.intent.setSubIntent(IntentClassifierService.MODE_CURRICULUM);
                state.intent.setRequiresCourseMaterial(false);
                state.ragAnswer = CourseRagAnswer.builder()
                        .answer(queries.curriculumOverviewService.newChatWelcomeMarkdown(state.courseId))
                        .confidence(1.0)
                        .sources(List.of())
                        .sourceEvidence(List.of())
                        .groundingType("COURSE_CURRICULUM")
                        .escalationRecommended(false)
                        .build();
            } else if (refuseWorker) {
                state.ragAnswer = queries.courseAnswerService.answerTutorInteraction(
                        state.question, state.courseId, state.intent.getSubIntent(),
                        state.pedagogicalContext, learnerContext, state.recentHistoryContext);
            } else if (state.provenanceIntent != null) {
                state.ragAnswer = queries.courseAnswerService.askWithImprovePlanContext(
                        state.question, state.courseId, state.classId, state.pedagogicalContext, learnerContext,
                        state.provenanceIntent, teachingPlan);
            } else if ("LEARNING_PATH".equalsIgnoreCase(teachingMode)
                    || StudentChatIntentDetector.isTopiclessStudyRequest(state.question)) {
                state.ragAnswer = queries.courseAnswerService.retrieveLearningPath(
                        state.question, state.courseId, state.classId, state.pedagogicalContext, learnerContext, retrievalHint);
            } else if (teachingPlan != null || !state.pedagogicalContext.isBlank() || !learnerContext.isBlank()) {
                state.ragAnswer = queries.courseAnswerService.askWithPersonalizedTutorContext(
                        state.question, state.courseId, state.classId, state.pedagogicalContext, learnerContext,
                        teachingMode, retrievalHint, teachingPlan);
            } else {
                state.ragAnswer = queries.courseAnswerService.askWithConfidence(
                        state.question, state.courseId, state.classId, teachingMode, retrievalHint);
            }
            state.answer = state.ragAnswer.getAnswer();
            state.lessonSuggestions = courseGreeting
                    ? List.of()
                    : LearningPathParser.parseLessonSuggestions(state.answer);
            if (!courseGreeting
                    && ("LEARNING_PATH".equalsIgnoreCase(state.intent.getSubIntent())
                    || StudentChatIntentDetector.isTopiclessStudyRequest(state.question))) {
                state.lessonSuggestions = queries.learningPathGroundingService.ground(
                        state.courseId,
                        state.question,
                        state.lessonSuggestions,
                        state.ragAnswer.getSourceEvidence(),
                        state.sessionSupportLevel
                );
                applyGroundedLearningPath(state.ragAnswer, state.lessonSuggestions, state.sessionSupportLevel);
                state.answer = state.ragAnswer.getAnswer();
            } else if (teachingPlan != null
                    && state.answer != null
                    && !state.answer.isBlank()
                    && !StudentFacingMessages.isUnavailableMessage(state.answer)) {
                String sessionKey = request.getTutorSessionId();
                if (state.ragAnswer.getCacheHitMetadata() != null) {
                    queries.teachingOrchestrator.commitCacheHit(teachingPlan, sessionKey);
                } else {
                    queries.teachingOrchestrator.commitApplied(teachingPlan, sessionKey);
                }
            } else if (teachingPlan != null
                    && (state.answer == null || state.answer.isBlank() || StudentFacingMessages.isUnavailableMessage(state.answer))) {
                queries.teachingOrchestrator.commitFailed(
                        teachingPlan, request.getTutorSessionId(), "Generation returned no usable state.answer");
            }

    }

    private ResponseEntity<?> saveTurn(
            TurnState state,
            AiQueryRequest request,
            String userName,
            String userEmail
    ) {
            QuestionEscalation questionEscalation = null;
            String conversationId = null;
            String userMessageId = null;
            String assistantMessageId = null;
            TutorSession tutorSessionState = null;

            queries.generationGate.checkpoint();
            if (state.persistTurn && state.userId != null && !state.userId.isBlank()) {
                if (state.courseId != null && !state.courseId.isBlank()) {
                    queries.studentCourseMemoryService.recordInteraction(
                            state.userId,
                            state.courseId,
                            state.classId,
                            state.question,
                            state.answer
                    );
                }

                if (Boolean.TRUE.equals(state.ragAnswer.getEscalationRecommended())) {
                    questionEscalation = queries.mentorEscalationService.createQuestionEscalation(
                            state.userId,
                            userEmail != null ? userEmail : "user@example.com",
                            userName != null ? userName : state.userId,
                            state.question,
                            state.answer,
                            state.courseId,
                            state.classId
                    );
                }

                var savedExchange = queries.aiConversationService.saveExchangeWithMessages(
                        state.userId,
                        request.getConversationId(),
                        state.courseId,
                        state.classId,
                        state.question,
                        state.answer,
                        questionEscalation != null ? questionEscalation.getId() : null,
                        state.routingMode,
                        state.ragAnswer.getConfidence(),
                        state.ragAnswer.getSources(),
                        state.ragAnswer.getSourceEvidence(),
                        state.ragAnswer.getGroundingType()
                );
                conversationId = savedExchange.conversationId();
                userMessageId = savedExchange.userMessageId();
                assistantMessageId = savedExchange.assistantMessageId();
                if (request.getTutorSessionId() != null && !request.getTutorSessionId().isBlank()) {
                    queries.aiConversationService.attachExchangeToTutorSession(
                            conversationId,
                            userMessageId,
                            assistantMessageId,
                            request.getTutorSessionId(),
                            request.getSessionPhase() == null ? "TEACH" : request.getSessionPhase()
                    );
                    tutorSessionState = queries.tutorSessionService.recordStudentTurn(
                            request.getTutorSessionId(), conversationId);
                    if (!state.lessonSuggestions.isEmpty()
                            && "LEARNING_PATH".equalsIgnoreCase(state.intent.getSubIntent())) {
                        tutorSessionState = queries.tutorSessionService.applyLearningPath(
                                request.getTutorSessionId(), state.question, state.lessonSuggestions);
                    }
                }
            }

            AiQueryResponse response = new AiQueryResponse();
            boolean escalated = questionEscalation != null;
            response.setMode(state.routingMode);
            response.setIntentReason(state.intent.getReason());
            response.setIntentConfidence(state.intent.getConfidence());
            applyIntentMetadata(response, state.intent);
            response.setAnswer(escalated ? state.ragAnswer.getAnswer() : state.answer);
            response.setConfidence(state.ragAnswer.getConfidence());
            response.setSources(state.ragAnswer.getSources());
            response.setSourceEvidence(state.ragAnswer.getSourceEvidence());
            response.setGroundingType(state.ragAnswer.getGroundingType());
            response.setEscalated(escalated);
            boolean aiUnavailableEscalation = escalated
                    && state.ragAnswer.getEscalationReason() != null
                    && state.ragAnswer.getEscalationReason().startsWith("All eligible LLM providers failed");
            response.setOutcome(escalated
                    ? (aiUnavailableEscalation ? "AI_UNAVAILABLE" : "NEEDS_MENTOR")
                    : (StudentFacingMessages.isUnavailableMessage(state.answer) ? "AI_UNAVAILABLE" : "ANSWERED"));
            response.setEscalationReason(escalated ? state.ragAnswer.getEscalationReason() : null);
            response.setConversationId(conversationId != null && !conversationId.isBlank()
                    ? conversationId
                    : (request.getConversationId() == null ? "" : request.getConversationId()));
            response.setUserMessageId(userMessageId);
            response.setAssistantMessageId(assistantMessageId);
            response.setCourseId(state.courseId);
            response.setSupportLevel(state.canonicalSupportLevel);
            response.setClickedSuggestion(request.getClickedSuggestion());
            response.setTutorSessionId(request.getTutorSessionId());
            response.setSessionPhase(tutorSessionState == null
                    ? (request.getSessionPhase() == null ? "TEACH" : request.getSessionPhase())
                    : tutorSessionState.getPhase());
            if (questionEscalation != null) {
                response.setQuestionEscalationId(questionEscalation.getId());
            }
            if (!state.lessonSuggestions.isEmpty()
                    && ("LEARNING_PATH".equalsIgnoreCase(state.intent.getSubIntent())
                    || StudentChatIntentDetector.isTopiclessStudyRequest(state.question))) {
                response.setNextImproveSuggestions(state.lessonSuggestions);
            }
            if (tutorSessionState != null && tutorSessionState.getSuggestedTopics() != null) {
                response.setSuggestedTopics(tutorSessionState.getSuggestedTopics());
            }
            applyDailyQuota(response, state.userId, state.courseId);

            return ResponseEntity.ok(response);
    }

    private static final class TurnState {
        String userId;
        String question;
        String courseId;
        String classId;
        String canonicalSupportLevel;
        boolean persistTurn;
        String recentHistoryContext;
        String sessionTopic;
        String sessionPhase;
        String sessionSupportLevel;
        List<String> sessionSuggestedTopics;
        String routingMode;
        IntentClassification intent;
        boolean guidedLesson;
        RagQueryIntent improvePlanIntent;
        RagQueryIntent provenanceIntent;
        PedagogicalDirectiveService.TutorGuidanceSnapshot tutorGuidance;
        String pedagogicalContext;
        String answer;
        List<SuggestionItem> lessonSuggestions;
        CourseRagAnswer ragAnswer;
    }
}
