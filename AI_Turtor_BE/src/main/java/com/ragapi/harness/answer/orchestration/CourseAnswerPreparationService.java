package com.ragapi.harness.answer.orchestration;
import static com.ragapi.util.ValidationUtils.STUDENT_QUESTION_MAX_LENGTH;
import static com.ragapi.util.ValidationUtils.requireMaxLength;
import static com.ragapi.util.ValidationUtils.requireText;

import com.ragapi.dto.CourseRagAnswer;
import com.ragapi.dto.RagQueryIntent;
import com.ragapi.dto.cotraining.ChapterPreviewView;
import com.ragapi.entity.CourseMaterial;
import com.ragapi.harness.answer.context.CourseLessonContextService;
import com.ragapi.harness.answer.grounding.CourseAnswerEvidenceService;
import com.ragapi.harness.model.CourseGroundingAssessment;
import com.ragapi.util.TextSanitizer;
import com.ragapi.harness.aiworker.PromptGuardService;
import com.ragapi.harness.learning.LearningPathGroundingService;
import com.ragapi.harness.answer.policy.CourseAnswerRequestPolicyService;
import com.ragapi.harness.model.CourseAnswerRequest;
import com.ragapi.harness.model.CourseContextRetrievalResult;
import com.ragapi.harness.model.RetrievedCourseChunk;
import com.ragapi.harness.retrieval.CourseContextRetrievalService;
import com.ragapi.harness.util.StudentChatIntentDetector;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;


/** Validates a request and prepares all evidence required by later answer stages. */
@Slf4j
@Service
@RequiredArgsConstructor
public class CourseAnswerPreparationService {

    private final CourseContextRetrievalService contextRetrievalService;
    private final CourseAnswerRequestPolicyService requestPolicyService;
    private final LearningPathGroundingService learningPathGroundingService;
    private final CourseLessonContextService lessonContextService;
    private final CourseAnswerEvidenceService evidenceService;
    private final PromptGuardService promptGuardService;

    public CourseAnswerPreparation prepare(CourseAnswerRequest request, long backendStartedNanos) {
        return prepare(request, backendStartedNanos, true);
    }

    public CourseAnswerPreparation prepare(CourseAnswerRequest request, long backendStartedNanos, boolean runPromptGuard) {
        String safeQuestion = requireMaxLength(request.question(), "question", STUDENT_QUESTION_MAX_LENGTH);
        String safeCourseId = requireText(request.courseId(), "courseId");
        boolean guidedLessonMode = requestPolicyService.isGuidedLessonMode(request.teachingMode());
        boolean understandingRemediation = requestPolicyService.isUnderstandingRemediation(safeQuestion);
        boolean personalizedPlan = request.teachingPlan() != null && request.teachingPlan().isPersonalized();
        boolean personalizedTutor = personalizedPlan
                || hasText(request.pedagogicalContext())
                || hasText(request.learnerMemoryContext());
        boolean skipAnswerCache = request.textbookOnly()
                || personalizedTutor
                || guidedLessonMode
                || understandingRemediation
                || request.ragQueryIntent() != null
                || StudentChatIntentDetector.isDependentFollowUp(safeQuestion);

        CourseRagAnswer immediateAnswer = requestPolicyService.buildSensitiveInternalAnswer(safeQuestion);
        if (immediateAnswer == null && !guidedLessonMode) {
            immediateAnswer = requestPolicyService.buildConversationalAnswer(safeQuestion, safeCourseId);
            if (immediateAnswer == null) {
                immediateAnswer = requestPolicyService.buildOffTopicRedirect(safeQuestion, safeCourseId);
                if (immediateAnswer != null) {
                    log.info("Blocked off-topic non-academic question before RAG (courseId={}): {}",
                            safeCourseId, safeQuestion);
                }
            }
        }
        if (immediateAnswer == null && StudentChatIntentDetector.isTopiclessStudyRequest(safeQuestion)) {
            immediateAnswer = requestPolicyService.buildStudyStartGuidance(
                    learningPathGroundingService.guidanceAnswer(safeCourseId));
            log.info("Guided a topicless study start without mentor escalation (courseId={})", safeCourseId);
        }
        if (immediateAnswer != null) {
            return emptyPreparation(
                    request,
                    backendStartedNanos,
                    safeQuestion,
                    safeCourseId,
                    skipAnswerCache,
                    understandingRemediation,
                    immediateAnswer
            );
        }

        if (runPromptGuard && promptGuardService.isPromptAttack(safeQuestion)) {
            log.warn("Prompt Guard blocked a likely prompt-injection attempt (courseId={})", safeCourseId);
            CourseRagAnswer blockedAnswer = CourseRagAnswer.builder()
                    .answer("Câu hỏi có dấu hiệu cố gắng ghi đè hướng dẫn hoặc vượt qua cơ chế an toàn nên tôi chưa thể xử lý. "
                            + "Em hãy gửi câu hỏi học tập cụ thể trong phạm vi môn học nhé.")
                    .confidence(0.0)
                    .sources(List.of())
                    .sourceEvidence(List.of())
                    .groundingType("NONE")
                    .escalationRecommended(false)
                    .escalationReason(null)
                    .build();
            return emptyPreparation(
                    request,
                    backendStartedNanos,
                    safeQuestion,
                    safeCourseId,
                    skipAnswerCache,
                    understandingRemediation,
                    blockedAnswer
            );
        }

        log.info(
                "Retrieving course learning context for question: {} (courseId: {}, currentClassId: {})",
                safeQuestion,
                safeCourseId,
                request.classId()
        );
        RagQueryIntent ragQueryIntent = request.ragQueryIntent();
        List<RetrievedCourseChunk> improvePlanChunks = lessonContextService.retrieveImprovePlanChunks(
                ragQueryIntent,
                safeCourseId,
                request.classId()
        );
        CourseContextRetrievalResult retrieval = contextRetrievalService.retrieve(
                safeQuestion,
                safeCourseId,
                request.classId(),
                request.textbookOnly(),
                request.retrievalHint(),
                ragQueryIntent,
                improvePlanChunks
        );
        List<RetrievedCourseChunk> chunks = new ArrayList<>(retrieval.chunks());
        ChapterPreviewView lessonPreview = lessonContextService.resolveLessonPreview(
                safeQuestion, safeCourseId, ragQueryIntent);
        chunks = lessonContextService.pinLessonPreviewChunk(lessonPreview, chunks);
        logImprovePlanRetrieval(ragQueryIntent, safeCourseId, retrieval.retrievalQuestion(), improvePlanChunks, chunks);

        log.info("Retrieved {} context chunks", chunks.size());
        String context = String.join("\n", chunks.stream().map(RetrievedCourseChunk::content).toList());
        context = lessonContextService.prependDraftTeachingNote(
                context,
                request.draftChapter(),
                request.draftTeachingNote(),
                request.baselineDraftAnswer()
        );
        Map<String, CourseMaterial> materialsById = contextRetrievalService.loadMetadata(chunks);
        String groundingType = evidenceService.resolveGroundingType(chunks, materialsById);
        List<String> sourceLabels = evidenceService.buildSourceLabels(chunks, materialsById);
        CourseGroundingAssessment grounding = assess(
                safeQuestion,
                retrieval.retrievalQuestion(),
                context,
                chunks,
                lessonContextService.hasUsableLessonPreview(lessonPreview)
        );

        return new CourseAnswerPreparation(
                request,
                backendStartedNanos,
                safeQuestion,
                safeCourseId,
                retrieval.retrievalQuestion(),
                List.copyOf(chunks),
                context,
                Map.copyOf(materialsById),
                groundingType,
                List.copyOf(sourceLabels),
                grounding.confidence(),
                grounding.grounded(),
                skipAnswerCache,
                understandingRemediation,
                null
        );
    }

    private CourseAnswerPreparation emptyPreparation(
            CourseAnswerRequest request,
            long backendStartedNanos,
            String question,
            String courseId,
            boolean skipAnswerCache,
            boolean understandingRemediation,
            CourseRagAnswer immediateAnswer
    ) {
        return new CourseAnswerPreparation(
                request,
                backendStartedNanos,
                question,
                courseId,
                question,
                List.of(),
                "",
                Map.of(),
                "NONE",
                List.of(),
                0.0,
                false,
                skipAnswerCache,
                understandingRemediation,
                immediateAnswer
        );
    }

    private void logImprovePlanRetrieval(
            RagQueryIntent intent,
            String courseId,
            String retrievalQuestion,
            List<RetrievedCourseChunk> linkedChunks,
            List<RetrievedCourseChunk> selectedChunks
    ) {
        if (intent == null) {
            return;
        }
        int requestedChunks = intent.getSourceChunkIds() == null ? 0 : intent.getSourceChunkIds().size();
        log.info(
                "Improve plan RAG retrieval (improvePlanId={}, planItemId={}, courseId={}, sourceMaterialCount={}, sourceChunkCount={}, retrievalQuery={}, linkedChunks={}, selectedChunks={})",
                intent.getImprovePlanId(),
                intent.getPlanItemId(),
                courseId,
                intent.getSourceMaterialIds() == null ? 0 : intent.getSourceMaterialIds().size(),
                requestedChunks,
                retrievalQuestion,
                linkedChunks.size(),
                selectedChunks.size()
        );
        if (requestedChunks > 0 && linkedChunks.isEmpty()) {
            log.warn(
                    "Improve-plan sourceChunkIds were ignored before semantic search "
                            + "(improvePlanId={}, courseId={}, sourceChunkIds={})",
                    intent.getImprovePlanId(),
                    courseId,
                    intent.getSourceChunkIds());
        }
    }

    private boolean hasText(String value) {
        return value != null && !value.isBlank();
    }


    private static final Pattern CODE_IDENTIFIER = Pattern.compile(
            "(?iu)(?<![\\p{L}\\p{N}_])([a-z_][a-z0-9_]{3,})(?![\\p{L}\\p{N}_])"
    );
    private static final double MIN_GROUNDED_CONFIDENCE = 0.6;
    /**
     * Lexical search marks a real hit at 0.65 and a filler hit at 0.55.
     * Vector and keyword scores for a selected passage are at least this high.
     * The score is the semantic match; this class does not keep a synonym list.
     */
    private static final double SEMANTIC_RETRIEVAL_SCORE = 0.65;
    private static final Set<String> STOP_WORDS = Set.of(
            "la", "gi", "gì", "cua", "của", "cho", "em", "anh", "chi", "chị",
            "the", "thế", "nao", "nào", "hay", "giai", "giải", "thich", "thích",
            "explain", "what", "is", "a", "an", "and", "or", "in", "on",
            "of", "to", "with", "about", "please", "help",
            "toi", "minh", "muon", "hoc", "cach", "tao", "hom", "nay", "ban",
            "bai", "ngay", "mot", "giup", "noi", "voi", "trong", "khi", "lam",
            "duoc", "khong", "can", "biet", "hieu"
    );

    public CourseGroundingAssessment assess(
            String question,
            String retrievalQuestion,
            String context,
            List<RetrievedCourseChunk> chunks,
            boolean hasLessonPreviewContext
    ) {
        double confidence = calculateConfidence(chunks);
        boolean grounded = hasGroundedContext(question, context)
                || hasGroundedContext(retrievalQuestion, context)
                || hasSemanticRetrievalSupport(chunks)
                || hasLessonPreviewContext;
        boolean hasApprovedKnowledge = chunks != null && chunks.stream().anyMatch(chunk ->
                "KNOWLEDGE_CANDIDATE".equalsIgnoreCase(chunk.sourceType())
                        || (chunk.content() != null && chunk.content().contains("KIẾN THỨC BỔ SUNG")));
        if (hasApprovedKnowledge) {
            grounded = true;
        }

        confidence = adjustConfidence(
                retrievalQuestion,
                context,
                chunks,
                confidence,
                grounded
        );
        if (hasLessonPreviewContext) {
            confidence = Math.max(confidence, MIN_GROUNDED_CONFIDENCE + 0.10);
        }
        if (hasApprovedKnowledge) {
            confidence = Math.max(confidence, MIN_GROUNDED_CONFIDENCE + 0.05);
        }
        return new CourseGroundingAssessment(confidence, grounded, hasApprovedKnowledge);
    }

    private double calculateConfidence(List<RetrievedCourseChunk> chunks) {
        if (chunks == null || chunks.isEmpty()) {
            return 0.0;
        }
        double averageScore = chunks.stream()
                .map(RetrievedCourseChunk::score)
                .filter(score -> score != null && !score.isNaN())
                .mapToDouble(Double::doubleValue)
                .average()
                .orElse(0.0);
        double sourceCoverage = Math.min(0.25, chunks.size() * 0.05);
        double scoreConfidence = averageScore <= 0 ? 0.25 : Math.min(0.55, averageScore / 2.0);
        return Math.min(0.95, 0.20 + sourceCoverage + scoreConfidence);
    }

    private double adjustConfidence(
            String question,
            String context,
            List<RetrievedCourseChunk> chunks,
            double currentConfidence,
            boolean grounded
    ) {
        if (!grounded || chunks == null || chunks.isEmpty()) {
            return currentConfidence;
        }
        String normalizedContext = normalize(context);
        long matchedTokens = significantTokens(question).stream()
                .filter(normalizedContext::contains)
                .count();
        if (hasSemanticRetrievalSupport(chunks) || matchedTokens >= 1) {
            return Math.max(currentConfidence, MIN_GROUNDED_CONFIDENCE + 0.08);
        }
        if (chunks.size() >= 3 && context != null && context.length() >= 250) {
            return Math.max(currentConfidence, MIN_GROUNDED_CONFIDENCE + 0.02);
        }
        return currentConfidence;
    }

    private boolean hasGroundedContext(String question, String context) {
        if (context == null || context.isBlank()) {
            return false;
        }
        String normalizedQuestion = normalize(question);
        String normalizedContext = normalize(context);
        if (hasMethodCallSupport(question, context)) {
            return true;
        }
        List<String> tokens = significantTokens(question);
        if (tokens.isEmpty()) {
            return false;
        }
        long matchedTokens = tokens.stream().filter(normalizedContext::contains).count();
        return matchedTokens >= Math.min(2, tokens.size());
    }

    private boolean hasMethodCallSupport(String question, String context) {
        String evidence = context == null ? "" : context.toLowerCase(Locale.ROOT);
        Matcher matcher = CODE_IDENTIFIER.matcher(question == null ? "" : question.toLowerCase(Locale.ROOT));
        while (matcher.find()) {
            String identifier = matcher.group(1);
            if (STOP_WORDS.contains(identifier)) {
                continue;
            }
            if (evidence.contains("." + identifier + "(") || evidence.contains(identifier + "(")) {
                return true;
            }
        }
        return false;
    }

    /** True when retrieval already selected this passage for the question. */
    private boolean hasSemanticRetrievalSupport(List<RetrievedCourseChunk> chunks) {
        if (chunks == null) {
            return false;
        }
        for (RetrievedCourseChunk chunk : chunks) {
            Double score = chunk.score();
            if (score != null && !score.isNaN() && score >= SEMANTIC_RETRIEVAL_SCORE) {
                return true;
            }
        }
        return false;
    }

    private List<String> significantTokens(String text) {
        String normalized = normalize(text);
        List<String> tokens = new ArrayList<>();
        for (String raw : normalized.split("\\s+")) {
            String token = raw.trim();
            if (token.length() >= 3 && !STOP_WORDS.contains(token) && !tokens.contains(token)) {
                tokens.add(token);
            }
        }
        return tokens;
    }

    private String normalize(String value) {
        return TextSanitizer.normalizeAccentInsensitive(value);
    }

}
