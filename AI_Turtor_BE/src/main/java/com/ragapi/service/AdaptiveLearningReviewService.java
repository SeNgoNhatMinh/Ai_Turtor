package com.ragapi.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.ragapi.dto.AdaptiveLearningReviewDecisionRequest;
import com.ragapi.dto.PedagogicalDirectiveRequest;
import com.ragapi.entity.AdaptiveLearningReview;
import com.ragapi.entity.AiMessage;
import com.ragapi.entity.PedagogicalDirective;
import com.ragapi.entity.TutorSession;
import com.ragapi.repository.AdaptiveLearningReviewRepository;
import com.ragapi.repository.AiMessageRepository;
import com.ragapi.repository.ClassSectionRepository;
import com.ragapi.repository.TutorSessionRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.scheduling.annotation.Async;

import java.time.LocalDateTime;
import java.util.*;

import static com.ragapi.util.ValidationUtils.requireText;

@Slf4j
@Service
@RequiredArgsConstructor
public class AdaptiveLearningReviewService {
    private static final int CYCLE_SIZE = 10;
    private static final Set<String> LEVELS = Set.of("HIGH_SUPPORT", "STANDARD", "CHALLENGE");
    private static final Set<String> DECISIONS = Set.of("APPROVE", "MODIFY", "REJECT");

    private final AdaptiveLearningReviewRepository reviewRepository;
    private final ClassSectionRepository classSectionRepository;
    private final ClassRosterService classRosterService;
    private final RealtimeEventService realtimeEvents;
    private final TutorSessionRepository sessionRepository;
    private final AiMessageRepository messageRepository;
    private final OpenRouterChatService chatService;
    private final ObjectMapper objectMapper;
    private final PedagogicalDirectiveService directiveService;

    /**
     * Called after a tutor session is durably marked COMPLETED. Reviews are idempotent per
     * student/course/completed-session count; a failed LLM assessment never rolls back the session.
     */
    @Async("adaptiveReviewExecutor")
    public void onSessionCompleted(TutorSession completedSession) {
        if (completedSession == null || !"COMPLETED".equalsIgnoreCase(completedSession.getStatus())) return;
        try {
            List<TutorSession> completed = sessionRepository
                    .findByStudentIdAndCourseIdOrderByStartedAtDesc(
                            completedSession.getStudentId(), completedSession.getCourseId())
                    .stream()
                    .filter(session -> "COMPLETED".equalsIgnoreCase(session.getStatus()))
                    .sorted(Comparator.comparing(TutorSession::getCompletedAt,
                            Comparator.nullsLast(Comparator.naturalOrder())))
                    .toList();
            int count = completed.size();
            if (count == 0 || count % CYCLE_SIZE != 0) return;
            if (reviewRepository.findByStudentIdAndCourseIdAndCompletedSessionCount(
                    completedSession.getStudentId(), completedSession.getCourseId(), count).isPresent()) return;

            List<TutorSession> cycle = completed.stream().skip(Math.max(0, count - CYCLE_SIZE)).toList();
            createReview(completedSession, cycle, count);
        } catch (Exception error) {
            // Review processing must not make session completion fail.
            log.error("Adaptive learning review failed for session {}: {}",
                    completedSession.getId(), error.getMessage(), error);
        }
    }

    private void createReview(TutorSession current, List<TutorSession> cycle, int completedCount) {
        LocalDateTime now = LocalDateTime.now();
        List<Map<String, Object>> evidence = buildEvidence(cycle);
        String transcriptForModel = evidence.stream().limit(36).map(item ->
                item.get("role") + ": " + item.get("content")).reduce((a, b) -> a + "\n" + b).orElse("");
        String prompt = """
                You are an evidence-based learning progress reviewer for an AI Tutor.
                Evaluate the student's learning from the provided recent conversation excerpts.
                Return ONLY valid JSON with keys: overallPercent, knowledgePercent, practicePercent,
                independencePercent, confidencePercent, summary, strengths, knowledgeGaps,
                teachingRecommendations, suggestedSupportLevel.
                Percentages must be integers from 0 to 100. Arrays must contain short Vietnamese strings.
                suggestedSupportLevel must be one of HIGH_SUPPORT, STANDARD, CHALLENGE.
                Use only evidence shown. Asking questions alone does not prove low mastery.
                Assistant explanations are not evidence that the student understood; prefer student responses,
                attempts, quiz results and independent reasoning. If evidence is weak, recommend STANDARD.
                Do not fabricate grades, events, or evidence. Use Vietnamese.
                Course: %s
                Current support level: %s
                Sessions in this cycle: %d
                Evidence excerpts:
                %s
                """.formatted(current.getCourseId(), current.getSupportLevel(), cycle.size(), transcriptForModel);
        Map<String, Object> assessment;
        String failure = null;
        try {
            String raw = chatService.generateUtility(prompt);
            assessment = objectMapper.readValue(extractJson(raw), new TypeReference<>() {});
            validateAssessment(assessment);
        } catch (Exception error) {
            failure = "Không thể hoàn tất đánh giá tự động: " + safeMessage(error);
            assessment = fallbackAssessment(current.getSupportLevel());
        }

        if (failure == null) assessment.put("confidencePercent", evidenceCompletenessPercent(evidence, cycle));
        String suggested = chooseSupportLevel(assessment, current.getSupportLevel());
        AdaptiveLearningReview review = AdaptiveLearningReview.builder()
                .id(UUID.randomUUID().toString())
                .studentId(current.getStudentId())
                .courseId(current.getCourseId())
                .classId(current.getClassId())
                .completedSessionCount(completedCount)
                .sessionIds(cycle.stream().map(TutorSession::getId).toList())
                .status("PENDING")
                .currentSupportLevel(normalizeLevel(current.getSupportLevel(), "STANDARD"))
                .suggestedSupportLevel(suggested)
                .overallPercent(number(assessment.get("overallPercent"), 0))
                .knowledgePercent(number(assessment.get("knowledgePercent"), 0))
                .practicePercent(number(assessment.get("practicePercent"), 0))
                .independencePercent(number(assessment.get("independencePercent"), 0))
                .confidencePercent(number(assessment.get("confidencePercent"), 0))
                .summary(string(assessment.get("summary"), "Chưa có tóm tắt đánh giá."))
                .strengths(strings(assessment.get("strengths")))
                .knowledgeGaps(strings(assessment.get("knowledgeGaps")))
                .teachingRecommendations(strings(assessment.get("teachingRecommendations")))
                .evidence(evidence)
                .evaluationError(failure)
                .createdAt(now)
                .updatedAt(now)
                .build();
        AdaptiveLearningReview saved = reviewRepository.save(review);
        publishReviewCreated(saved);
    }

    private void publishReviewCreated(AdaptiveLearningReview review) {
        if (review.getClassId() == null || review.getClassId().isBlank()) return;
        classSectionRepository.findByCourseIdAndClassId(review.getCourseId(), review.getClassId())
                .map(section -> section.getTeacherId())
                .filter(teacherId -> teacherId != null && !teacherId.isBlank())
                .ifPresent(teacherId -> realtimeEvents.publishToUser(
                        teacherId,
                        "ADAPTIVE_LEARNING_REVIEW_CREATED",
                        "ADAPTIVE_LEARNING_REVIEW",
                        review.getId(),
                        review.getStatus(),
                        Map.of(
                                "reviewId", review.getId(),
                                "courseId", review.getCourseId(),
                                "classId", review.getClassId(),
                                "studentId", review.getStudentId(),
                                "overallPercent", review.getOverallPercent(),
                                "status", review.getStatus()
                        )));
    }

    public Optional<String> adaptiveSupportLevel(String studentId, String courseId, String classId) {
        return reviewRepository.findByStudentIdAndCourseIdAndClassIdOrderByCreatedAtDesc(studentId, courseId, classId)
                .stream()
                .filter(review -> review.getEvaluationError() == null || review.getEvaluationError().isBlank())
                .filter(review -> review.getConfidencePercent() != null && review.getConfidencePercent() >= 65)
                .filter(review -> Set.of("PENDING", "APPROVED").contains(
                        review.getStatus() == null ? "" : review.getStatus().toUpperCase(Locale.ROOT)))
                .map(review -> normalizeLevel(review.getSuggestedSupportLevel(), "STANDARD"))
                .findFirst();
    }

    private List<Map<String, Object>> buildEvidence(List<TutorSession> sessions) {
        List<Map<String, Object>> result = new ArrayList<>();
        for (TutorSession session : sessions) {
            List<String> ids = session.getConversationIds() == null ? List.of() : session.getConversationIds();
            for (String conversationId : ids) {
                if (conversationId == null || conversationId.isBlank()) continue;
                List<AiMessage> messages = messageRepository.findByConversationIdOrderByCreatedAtAsc(conversationId);
                for (AiMessage message : messages) {
                    if (message.getContent() == null || message.getContent().isBlank()) continue;
                    String role = message.getRole() == null ? "UNKNOWN" : message.getRole().toUpperCase(Locale.ROOT);
                    if (!Set.of("STUDENT", "ASSISTANT").contains(role)) continue;
                    Map<String, Object> item = new LinkedHashMap<>();
                    item.put("messageId", message.getId());
                    item.put("sessionId", session.getId());
                    item.put("conversationId", conversationId);
                    item.put("role", role);
                    item.put("topic", session.getTopic() == null ? "" : session.getTopic());
                    item.put("content", truncate(message.getContent(), 1200));
                    item.put("createdAt", message.getCreatedAt() == null ? null : message.getCreatedAt().toString());
                    item.put("understandingCorrect", message.getUnderstandingCorrect());
                    result.add(item);
                }
            }
        }
        return result;
    }

    public List<AdaptiveLearningReview> listForTeacher(String courseId, String classId) {
        String safeCourse = requireText(courseId, "courseId");
        String safeClass = requireText(classId, "classId");
        List<AdaptiveLearningReview> reviews = reviewRepository.findByCourseIdAndClassIdOrderByCreatedAtDesc(safeCourse, safeClass);
        reviews.forEach(this::attachStudentIdentity);
        return reviews;
    }

    public AdaptiveLearningReview get(String reviewId) {
        AdaptiveLearningReview review = reviewRepository.findById(requireText(reviewId, "reviewId"))
                .orElseThrow(() -> new IllegalArgumentException("Adaptive learning review not found"));
        attachStudentIdentity(review);
        return review;
    }

    public AdaptiveLearningReview decide(
            String reviewId, String teacherId, AdaptiveLearningReviewDecisionRequest request) {
        if (request == null) throw new IllegalArgumentException("Request body is required");
        AdaptiveLearningReview review = get(reviewId);
        if (!"PENDING".equalsIgnoreCase(review.getStatus())) {
            throw new IllegalStateException("This review has already been processed");
        }
        String decision = requireText(request.getDecision(), "decision").toUpperCase(Locale.ROOT);
        if (!DECISIONS.contains(decision)) throw new IllegalArgumentException("Unsupported decision");
        String feedback = request.getTeacherFeedback() == null ? "" : request.getTeacherFeedback().trim();
        if (feedback.length() > 5000) throw new IllegalArgumentException("Teacher feedback exceeds 5000 characters");

        review.setTeacherId(requireText(teacherId, "teacherId"));
        review.setTeacherFeedback(feedback);
        review.setTeacherDecision(decision);
        review.setReviewedAt(LocalDateTime.now());
        review.setUpdatedAt(LocalDateTime.now());

        if ("REJECT".equals(decision)) {
            review.setStatus("REJECTED");
            return reviewRepository.save(review);
        }

        String selectedLevel = "MODIFY".equals(decision)
                ? normalizeLevel(request.getSupportLevel(), review.getSuggestedSupportLevel())
                : review.getSuggestedSupportLevel();
        String instruction = buildTeacherInstruction(review, feedback);
        PedagogicalDirectiveRequest directiveRequest = new PedagogicalDirectiveRequest();
        directiveRequest.setStudentId(review.getStudentId());
        directiveRequest.setCourseId(review.getCourseId());
        directiveRequest.setClassId(review.getClassId());
        directiveRequest.setTopic(String.join(", ", safeList(review.getKnowledgeGaps())));
        directiveRequest.setInstruction(instruction);
        directiveRequest.setSupportLevel(selectedLevel);
        directiveRequest.setPriority(85);
        PedagogicalDirective draft = directiveService.createDraft(directiveRequest, teacherId, teacherId);
        PedagogicalDirective confirmed = directiveService.confirm(draft.getId(), teacherId);
        review.setAppliedDirectiveId(confirmed.getId());
        review.setSuggestedSupportLevel(selectedLevel);
        review.setStatus("APPROVED");
        return reviewRepository.save(review);
    }

    private void attachStudentIdentity(AdaptiveLearningReview review) {
        if (review == null || review.getStudentId() == null) return;
        var identity = classRosterService.resolveStudent(
                review.getStudentId(), review.getCourseId(), review.getClassId());
        if (identity == null) return;
        review.setStudentName(identity.getStudentName());
        review.setStudentCode(identity.getStudentCode());
        review.setStudentEmail(identity.getStudentEmail());
    }

    private String buildTeacherInstruction(AdaptiveLearningReview review, String feedback) {
        StringBuilder text = new StringBuilder("Adaptive review after ")
                .append(review.getCompletedSessionCount())
                .append(" completed tutor sessions. Teaching recommendations: ")
                .append(String.join("; ", safeList(review.getTeachingRecommendations())));
        if (!safeList(review.getKnowledgeGaps()).isEmpty()) {
            text.append(". Focus on knowledge gaps: ").append(String.join("; ", review.getKnowledgeGaps()));
        }
        if (!feedback.isBlank()) text.append(". Teacher-approved guidance: ").append(feedback);
        text.append(". Treat this as pedagogical guidance, not as a replacement for course-source facts. ")
                .append("Check understanding with a fresh task before reducing support.");
        return text.toString();
    }

    private void validateAssessment(Map<String, Object> map) {
        for (String key : List.of("overallPercent", "knowledgePercent", "practicePercent",
                "independencePercent", "confidencePercent")) {
            int value = number(map.get(key), -1);
            if (value < 0 || value > 100) throw new IllegalArgumentException("Invalid percentage: " + key);
        }
        if (string(map.get("summary"), "").isBlank()) throw new IllegalArgumentException("Missing summary");
        normalizeLevel(map.get("suggestedSupportLevel"), "STANDARD");
    }

    private int evidenceCompletenessPercent(List<Map<String, Object>> evidence, List<TutorSession> cycle) {
        Set<String> sessionsWithStudentResponse = new HashSet<>();
        int studentResponses = 0;
        for (Map<String, Object> item : evidence) {
            if (!"STUDENT".equals(item.get("role"))) continue;
            studentResponses++;
            Object sessionId = item.get("sessionId");
            if (sessionId != null) sessionsWithStudentResponse.add(String.valueOf(sessionId));
        }
        int sessionCoverage = cycle.isEmpty() ? 0
                : (int) Math.round(50.0 * sessionsWithStudentResponse.size() / cycle.size());
        int responseCoverage = (int) Math.round(2.0 * Math.min(studentResponses, 25));
        return Math.max(0, Math.min(100, sessionCoverage + responseCoverage));
    }

    private String chooseSupportLevel(Map<String, Object> assessment, String currentLevel) {
        String current = normalizeLevel(currentLevel, "STANDARD");
        int confidence = number(assessment.get("confidencePercent"), 0);
        int overall = number(assessment.get("overallPercent"), 0);
        int knowledge = number(assessment.get("knowledgePercent"), 0);
        int practice = number(assessment.get("practicePercent"), 0);
        int independence = number(assessment.get("independencePercent"), 0);

        // Do not change the level automatically when the evidence is too weak.
        if (confidence < 65) return current;
        if (overall <= 50 || knowledge <= 45) return "HIGH_SUPPORT";
        if (overall >= 85 && practice >= 80 && independence >= 80) return "CHALLENGE";
        if (overall >= 70 && independence >= 65 && "HIGH_SUPPORT".equals(current)) return "STANDARD";
        if ("CHALLENGE".equals(current) && (overall < 75 || independence < 65)) return "STANDARD";
        return normalizeLevel(assessment.get("suggestedSupportLevel"), current);
    }

    private Map<String, Object> fallbackAssessment(String currentLevel) {
        Map<String, Object> map = new LinkedHashMap<>();
        map.put("overallPercent", 0);
        map.put("knowledgePercent", 0);
        map.put("practicePercent", 0);
        map.put("independencePercent", 0);
        map.put("confidencePercent", 0);
        map.put("summary", "Chưa đủ dữ liệu đáng tin cậy để kết luận; giảng viên cần xem bằng chứng trước khi điều chỉnh.");
        map.put("strengths", List.of());
        map.put("knowledgeGaps", List.of());
        map.put("teachingRecommendations", List.of("Xem lại log hội thoại và yêu cầu sinh viên làm một bài kiểm tra mới."));
        map.put("suggestedSupportLevel", normalizeLevel(currentLevel, "STANDARD"));
        return map;
    }

    private String extractJson(String raw) {
        if (raw == null || raw.isBlank()) throw new IllegalArgumentException("Empty LLM response");
        String cleaned = raw.trim().replaceFirst("^\uFEFF", "");
        if (cleaned.startsWith("```")) {
            cleaned = cleaned.replaceFirst("^```(?:json)?\\s*", "").replaceFirst("\\s*```$", "");
        }
        int start = cleaned.indexOf('{');
        int end = cleaned.lastIndexOf('}');
        if (start < 0 || end <= start) throw new IllegalArgumentException("LLM did not return JSON");
        return cleaned.substring(start, end + 1);
    }

    private String normalizeLevel(Object value, String fallback) {
        String level = value == null ? "" : value.toString().trim().toUpperCase(Locale.ROOT);
        if (LEVELS.contains(level)) return level;
        String safeFallback = fallback == null ? "STANDARD" : fallback.trim().toUpperCase(Locale.ROOT);
        return LEVELS.contains(safeFallback) ? safeFallback : "STANDARD";
    }

    private int number(Object value, int fallback) {
        if (value instanceof Number n) return n.intValue();
        try { return Integer.parseInt(String.valueOf(value)); }
        catch (Exception ignored) { return fallback; }
    }

    private String string(Object value, String fallback) {
        return value == null ? fallback : String.valueOf(value);
    }

    private List<String> strings(Object value) {
        if (!(value instanceof Collection<?> collection)) return List.of();
        return collection.stream().filter(Objects::nonNull).map(String::valueOf)
                .map(String::trim).filter(item -> !item.isBlank()).limit(12).toList();
    }

    private List<String> safeList(List<String> value) {
        return value == null ? List.of() : value;
    }

    private String truncate(String value, int max) {
        if (value == null) return "";
        return value.length() <= max ? value : value.substring(0, max) + "…";
    }

    private String safeMessage(Exception error) {
        return error.getMessage() == null ? error.getClass().getSimpleName() : truncate(error.getMessage(), 250);
    }
}
