package com.ragapi.service;

import com.ragapi.dto.AiConversationSummary;
import com.ragapi.dto.CourseCurriculumOverview;
import com.ragapi.dto.OpenTutorSessionRequest;
import com.ragapi.dto.SuggestionItem;
import com.ragapi.dto.UpdateTutorSessionRequest;
import com.ragapi.entity.*;
import com.ragapi.repository.*;
import com.ragapi.util.LearningPathParser;
import com.ragapi.util.TutorStudySuggestionUtils;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.*;

import static com.ragapi.util.ValidationUtils.requireText;

@Service
@RequiredArgsConstructor
public class TutorSessionService {
    private static final Set<String> PHASES =
            Set.of("OPEN", "DIAGNOSTIC", "TEACH", "PRACTICE", "REFLECT", "CLOSED");
    private static final Set<String> SUPPORT_LEVELS =
            Set.of("HIGH_SUPPORT", "STANDARD", "CHALLENGE");

    private final TutorSessionRepository sessionRepository;
    private final TutorSessionSummaryRepository summaryRepository;
    private final PedagogicalDirectiveRepository directiveRepository;
    private final StudentCourseMemoryRepository memoryRepository;
    private final AiMessageRepository messageRepository;
    private final AiConversationService conversationService;
    private final ChapterOutlineService chapterOutlineService;
    private final CourseCurriculumOverviewService curriculumOverviewService;
    private final RealtimeEventService realtimeEvents;

    public Map<String, Object> openOrResume(OpenTutorSessionRequest request) {
        if (request == null) throw new IllegalArgumentException("request is required");
        String studentId = requireText(request.getStudentId(), "studentId");
        String courseId = requireText(request.getCourseId(), "courseId");
        Optional<TutorSession> active = sessionRepository
                .findFirstByStudentIdAndCourseIdAndStatusOrderByUpdatedAtDesc(studentId, courseId, "ACTIVE");
        if (active.isPresent()) {
            TutorSession session = active.get();
            boolean suggestionsChanged = refreshOpeningSuggestions(session);
            AiConversationSummary conversation = ensureTutorConversation(
                    session, studentId, courseId, request.getClassId());
            AiMessage openingMessage = ensureOpeningMessage(
                    session, studentId, conversation.getConversationId(), suggestionsChanged);
            String eventType = openingMessage == null ? "TUTOR_SESSION_UPDATED" : "TUTOR_SESSION_OPENED";
            publishTutorSession(eventType, session, conversation.getConversationId(), openingMessage);
            return response(session, conversation.getConversationId(), openingMessage, true);
        }

        LocalDateTime now = LocalDateTime.now();
        List<String> suggestions = suggestedTopics(studentId, courseId);
        String supportLevel = resolveSupportLevel(studentId, courseId, request.getClassId());
        TutorSession session = sessionRepository.save(TutorSession.builder()
                .id(UUID.randomUUID().toString())
                .studentId(studentId)
                .courseId(courseId)
                .classId(trimToNull(request.getClassId()))
                .topic(trimToNull(request.getTopic()))
                .goal(trimToNull(request.getGoal()))
                .status("ACTIVE")
                .phase("OPEN")
                .supportLevel(supportLevel)
                .suggestedTopics(suggestions)
                .startedAt(now)
                .updatedAt(now)
                .build());

        AiConversationSummary conversation = conversationService.createTutorConversation(
                studentId, courseId, request.getClassId(), session.getId());
        ensureConversationIds(session).add(conversation.getConversationId());
        sessionRepository.save(session);
        AiMessage message = appendOpening(session, studentId, conversation.getConversationId());
        publishTutorSession("TUTOR_SESSION_OPENED", session, conversation.getConversationId(), message);
        return response(session, conversation.getConversationId(), message, false);
    }

    public TutorSession update(String sessionId, UpdateTutorSessionRequest request) {
        TutorSession session = requireSession(sessionId);
        if (request == null) throw new IllegalArgumentException("request is required");
        if (request.getTopic() != null) session.setTopic(trimToNull(request.getTopic()));
        if (request.getGoal() != null) session.setGoal(trimToNull(request.getGoal()));
        if (request.getPhase() != null && !request.getPhase().isBlank()) {
            String phase = request.getPhase().trim().toUpperCase(Locale.ROOT);
            if (!PHASES.contains(phase)) throw new IllegalArgumentException("Unsupported tutor phase");
            session.setPhase(phase);
        }
        if (request.getSupportLevel() != null && !request.getSupportLevel().isBlank()) {
            String level = request.getSupportLevel().trim().toUpperCase(Locale.ROOT);
            if (!SUPPORT_LEVELS.contains(level)) throw new IllegalArgumentException("Unsupported support level");
            session.setSupportLevel(level);
        }
        session.setUpdatedAt(LocalDateTime.now());
        return sessionRepository.save(session);
    }

    public TutorSessionSummary close(String sessionId) {
        TutorSession session = requireSession(sessionId);
        TutorSessionSummary existing = summaryRepository.findBySessionId(sessionId).orElse(null);
        if (existing != null) return existing;

        List<AiMessage> messages = session.getConversationIds().stream()
                .filter(Objects::nonNull)
                .flatMap(id -> messageRepository.findByConversationIdOrderByCreatedAtAsc(id).stream())
                .sorted(Comparator.comparing(AiMessage::getCreatedAt, Comparator.nullsLast(Comparator.naturalOrder())))
                .toList();
        List<String> questions = messages.stream()
                .filter(message -> "STUDENT".equalsIgnoreCase(message.getRole()))
                .map(AiMessage::getContent)
                .filter(Objects::nonNull)
                .toList();
        StudentCourseMemory memory = memoryRepository
                .findByStudentIdAndCourseId(session.getStudentId(), session.getCourseId())
                .orElse(null);
        List<String> nextSteps = memory == null ? List.of() :
                firstNonEmpty(memory.getImproveSuggestions(), memory.getWeakTopics(), 4);
        List<String> covered = new ArrayList<>();
        if (session.getTopic() != null) covered.add(session.getTopic());
        questions.stream().limit(4).forEach(question -> {
            if (!covered.contains(question)) covered.add(question);
        });
        String summaryText = questions.isEmpty()
                ? "Sinh viên đã mở buổi học nhưng chưa thực hiện lượt học nào."
                : "Sinh viên đã thực hiện " + questions.size() + " lượt học"
                + (session.getTopic() == null ? "." : " về chủ đề " + session.getTopic() + ".");
        TutorSessionSummary summary = summaryRepository.save(TutorSessionSummary.builder()
                .id(UUID.randomUUID().toString())
                .sessionId(session.getId())
                .studentId(session.getStudentId())
                .courseId(session.getCourseId())
                .classId(session.getClassId())
                .topic(session.getTopic())
                .supportLevel(session.getSupportLevel())
                .summaryText(summaryText)
                .topicsCovered(covered)
                .misconceptions(memory == null ? List.of() : limit(memory.getWeakTopics(), 4))
                .strengths(memory == null ? List.of() : limit(memory.getLearnedTopics(), 4))
                .recommendedNextSteps(nextSteps)
                .conversationIds(new ArrayList<>(session.getConversationIds()))
                .studentTurnCount(questions.size())
                .generationMethod("STRUCTURED_V1")
                .createdAt(LocalDateTime.now())
                .sharedWithTeacherAt(LocalDateTime.now())
                .build());
        session.setStatus("COMPLETED");
        session.setPhase("CLOSED");
        session.setSummaryId(summary.getId());
        session.setCompletedAt(LocalDateTime.now());
        session.setUpdatedAt(LocalDateTime.now());
        sessionRepository.save(session);
        return summary;
    }

    public List<TutorSessionSummary> listTeacherSummaries(String courseId, String classId) {
        return summaryRepository.findByCourseIdAndClassIdOrderByCreatedAtDesc(
                requireText(courseId, "courseId"), requireText(classId, "classId"));
    }

    public List<TutorSession> listStudentSessions(String studentId, String courseId) {
        return sessionRepository.findByStudentIdAndCourseIdOrderByStartedAtDesc(
                requireText(studentId, "studentId"), requireText(courseId, "courseId"));
    }

    public TutorSession getSession(String sessionId) {
        return requireSession(sessionId);
    }

    public TutorSession registerConversation(String sessionId, String conversationId) {
        TutorSession session = requireSession(sessionId);
        if (conversationId != null && !conversationId.isBlank()
                && !session.getConversationIds().contains(conversationId)) {
            session.getConversationIds().add(conversationId);
            session.setUpdatedAt(LocalDateTime.now());
            return sessionRepository.save(session);
        }
        return session;
    }

    public TutorSession recordStudentTurn(String sessionId, String conversationId) {
        TutorSession session = registerConversation(sessionId, conversationId);
        long studentTurns = session.getConversationIds().stream()
                .filter(Objects::nonNull)
                .distinct()
                .mapToLong(id -> messageRepository.countByConversationIdAndRole(id, "STUDENT"))
                .sum();
        if (studentTurns >= 10 && "ACTIVE".equalsIgnoreCase(session.getStatus())) {
            close(sessionId);
            return requireSession(sessionId);
        }
        session.setUpdatedAt(LocalDateTime.now());
        return sessionRepository.save(session);
    }

    public TutorSession applyLearningPath(String sessionId, String topic, List<SuggestionItem> lessons) {
        if (sessionId == null || sessionId.isBlank()) {
            return null;
        }
        TutorSession session = requireSession(sessionId);
        if ("COMPLETED".equalsIgnoreCase(session.getStatus())) {
            return session;
        }
        List<String> starters = LearningPathParser.lessonStarterTexts(lessons);
        if (!starters.isEmpty()) {
            session.setSuggestedTopics(new ArrayList<>(starters));
            if ("OPEN".equalsIgnoreCase(session.getPhase())
                    || "DIAGNOSTIC".equalsIgnoreCase(session.getPhase())) {
                session.setPhase("TEACH");
            }
        }
        if (session.getTopic() == null || session.getTopic().isBlank()) {
            session.setTopic(trimToNull(topic));
        }
        session.setUpdatedAt(LocalDateTime.now());
        TutorSession saved = sessionRepository.save(session);
        publishTutorSession("TUTOR_SESSION_UPDATED", saved, lastConversationId(saved), null);
        return saved;
    }

    public String courseChapterTitleHints(String courseId) {
        if (courseId == null || courseId.isBlank()) {
            return "";
        }
        try {
            List<String> titles = chapterOutlineService.suggestChapters(courseId).stream()
                    .map(view -> view.getTitle())
                    .filter(Objects::nonNull)
                    .map(String::trim)
                    .filter(title -> !title.isBlank())
                    .limit(12)
                    .toList();
            if (titles.isEmpty()) {
                return "";
            }
            StringBuilder hints = new StringBuilder(
                    "- Course chapter titles that may inform a lesson path (facts still come from retrieved materials):\n");
            titles.forEach(title -> hints.append("  - ").append(title).append("\n"));
            return hints.toString().trim();
        } catch (Exception ignored) {
            return "";
        }
    }

    public TutorSessionSummary getSummary(String summaryId) {
        return summaryRepository.findById(requireText(summaryId, "summaryId"))
                .orElseThrow(() -> new IllegalArgumentException("Tutor session summary not found"));
    }

    public List<AiMessage> getSummaryTranscript(String summaryId) {
        TutorSessionSummary summary = getSummary(summaryId);
        return summary.getConversationIds().stream()
                .filter(Objects::nonNull)
                .flatMap(id -> messageRepository.findByConversationIdOrderByCreatedAtAsc(id).stream())
                .sorted(Comparator.comparing(AiMessage::getCreatedAt, Comparator.nullsLast(Comparator.naturalOrder())))
                .toList();
    }

    private List<String> suggestedTopics(String studentId, String courseId) {
        List<String> weakTopics = memoryRepository.findByStudentIdAndCourseId(studentId, courseId)
                .map(memory -> limit(memory.getWeakTopics(), 3))
                .orElse(List.of());
        List<TutorStudySuggestionUtils.RankedTitle> chapters = List.of();
        try {
            chapters = chapterOutlineService.suggestChapters(courseId).stream()
                    .filter(Objects::nonNull)
                    .map(view -> new TutorStudySuggestionUtils.RankedTitle(
                            view.getTitle(),
                            view.getPageStart(),
                            view.getTocLevel()))
                    .toList();
        } catch (Exception ignored) {
            // Opening still greets; chips fall back to new-course starters.
        }
        List<String> fromOutline = TutorStudySuggestionUtils.openingSuggestions(courseId, weakTopics, chapters);
        if (fromOutline.stream().anyMatch(TutorStudySuggestionUtils::looksNumbered)) {
            return fromOutline;
        }
        List<String> curriculum = List.of();
        try {
            curriculum = curriculumOverviewService.forCourse(courseId).unitTitles();
        } catch (Exception ignored) {
            // Opening still greets from chapter titles when the overview model is unavailable.
        }
        if (!curriculum.isEmpty()) {
            LinkedHashSet<String> result = new LinkedHashSet<>();
            weakTopics.stream()
                    .filter(Objects::nonNull)
                    .map(String::trim)
                    .filter(topic -> !topic.isBlank())
                    .limit(2)
                    .forEach(result::add);
            curriculum.forEach(result::add);
            return result.stream().limit(6).toList();
        }
        return fromOutline;
    }

    private AiConversationSummary ensureTutorConversation(
            TutorSession session, String studentId, String courseId, String classId) {
        List<String> ids = ensureConversationIds(session);
        String existingId = lastConversationId(session);
        return conversationService.findOwnedSummary(existingId, studentId)
                .orElseGet(() -> {
                    ids.removeIf(id -> id == null || id.isBlank()
                            || !conversationService.existsForUser(id, studentId));
                    AiConversationSummary created = conversationService.createTutorConversation(
                            studentId, courseId, classId, session.getId());
                    ids.add(created.getConversationId());
                    session.setUpdatedAt(LocalDateTime.now());
                    sessionRepository.save(session);
                    return created;
                });
    }

    private List<String> ensureConversationIds(TutorSession session) {
        if (session.getConversationIds() == null) {
            session.setConversationIds(new ArrayList<>());
        }
        return session.getConversationIds();
    }

    private boolean refreshOpeningSuggestions(TutorSession session) {
        if (!TutorStudySuggestionUtils.needsSuggestionRefresh(session.getSuggestedTopics())) {
            return false;
        }
        session.setSuggestedTopics(suggestedTopics(session.getStudentId(), session.getCourseId()));
        session.setUpdatedAt(LocalDateTime.now());
        sessionRepository.save(session);
        return true;
    }

    private AiMessage ensureOpeningMessage(
            TutorSession session, String studentId, String conversationId, boolean rewriteStaleOpening) {
        if (conversationId == null || conversationId.isBlank()) {
            return null;
        }
        List<AiMessage> existing = messageRepository.findByConversationIdOrderByCreatedAtAsc(conversationId);
        if (existing.isEmpty()) {
            return appendOpening(session, studentId, conversationId);
        }
        if (existing.size() == 1) {
            AiMessage only = existing.get(0);
            if (isProactiveAssistant(only) && (rewriteStaleOpening || isStaleOpening(session, only.getContent()))) {
                only.setContent(buildOpening(session));
                return messageRepository.save(only);
            }
        }
        return null;
    }

    private boolean isProactiveAssistant(AiMessage message) {
        return message != null
                && "ASSISTANT".equalsIgnoreCase(message.getRole())
                && Boolean.TRUE.equals(message.getProactive());
    }

    private boolean isStaleOpening(TutorSession session, String content) {
        if (content == null || content.isBlank()) {
            return true;
        }
        String lower = content.toLowerCase(Locale.ROOT);
        if (lower.contains("about the author")
                || lower.contains("about the technical")
                || lower.contains("a timeline of java")
                || lower.contains("gồm những nội dung nào")
                || lower.contains("a string is a sequence")
                || lower.contains("adding new functions")) {
            return true;
        }
        if (hasNumberedLessonPath(session)) {
            return false;
        }
        return !lower.contains("nội dung chính trong chương trình học");
    }

    private boolean hasNumberedLessonPath(TutorSession session) {
        List<String> suggestions = session == null || session.getSuggestedTopics() == null
                ? List.of()
                : session.getSuggestedTopics();
        return suggestions.stream().anyMatch(TutorStudySuggestionUtils::looksNumbered);
    }

    private AiMessage appendOpening(TutorSession session, String studentId, String conversationId) {
        String opening = buildOpening(session);
        if (opening == null || opening.isBlank() || conversationId == null || conversationId.isBlank()) {
            return null;
        }
        return conversationService.appendProactiveAssistantMessage(
                conversationId, studentId, session.getId(), "OPEN", opening);
    }

    private void publishTutorSession(
            String eventType, TutorSession session, String conversationId, AiMessage openingMessage) {
        if (session == null || session.getStudentId() == null || session.getStudentId().isBlank()) {
            return;
        }
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("session", session);
        data.put("conversationId", conversationId == null ? "" : conversationId);
        data.put("courseId", session.getCourseId() == null ? "" : session.getCourseId());
        data.put("openingMessage", openingPayload(openingMessage, session));
        realtimeEvents.publishToUser(
                session.getStudentId(),
                eventType,
                "TUTOR_SESSION",
                session.getId(),
                session.getStatus(),
                data);
    }

    private Map<String, Object> openingPayload(AiMessage openingMessage, TutorSession session) {
        if (openingMessage == null) {
            return Map.of();
        }
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("messageId", openingMessage.getId());
        payload.put("role", openingMessage.getRole());
        payload.put("content", openingMessage.getContent());
        payload.put("proactive", true);
        payload.put("sessionPhase", session == null ? "OPEN" : session.getPhase());
        return payload;
    }

    private String lastConversationId(TutorSession session) {
        if (session == null || session.getConversationIds() == null) {
            return "";
        }
        return session.getConversationIds().stream()
                .filter(Objects::nonNull)
                .filter(id -> !id.isBlank())
                .reduce((first, second) -> second)
                .orElse("");
    }

    private String resolveSupportLevel(String studentId, String courseId, String classId) {
        List<PedagogicalDirective> directives = new ArrayList<>(
                directiveRepository.findByStudentIdAndCourseIdAndStatusOrderByPriorityDescUpdatedAtDesc(
                        studentId, courseId, "CONFIRMED"));
        if (classId != null && !classId.isBlank()) {
            directives.addAll(directiveRepository
                    .findByCourseIdAndClassIdAndStatusOrderByPriorityDescUpdatedAtDesc(
                            courseId, classId, "CONFIRMED"));
        }
        Optional<String> directiveLevel = directives.stream()
                .filter(this::isEffective)
                .map(PedagogicalDirective::getSupportLevel)
                .filter(Objects::nonNull)
                .filter(SUPPORT_LEVELS::contains)
                .findFirst();
        if (directiveLevel.isPresent()) return directiveLevel.get();
        return memoryRepository.findByStudentIdAndCourseId(studentId, courseId)
                .filter(memory -> memory.getWeakTopics() != null && !memory.getWeakTopics().isEmpty())
                .map(memory -> "HIGH_SUPPORT")
                .orElse("STANDARD");
    }

    private String buildOpening(TutorSession session) {
        List<String> suggestions = session.getSuggestedTopics() == null ? List.of() : session.getSuggestedTopics();
        boolean hasTopic = session.getTopic() != null && !session.getTopic().isBlank();
        boolean hasLessons = hasNumberedLessonPath(session);
        CourseCurriculumOverview overview = CourseCurriculumOverview.empty(session.getCourseId());
        if (!hasLessons) {
            try {
                overview = curriculumOverviewService.forCourse(session.getCourseId());
            } catch (Exception ignored) {
                overview = CourseCurriculumOverview.empty(session.getCourseId());
            }
        }
        StringBuilder opening = new StringBuilder("## Chào mừng bạn đến với môn ")
                .append(session.getCourseId());
        if (overview.courseName() != null && !overview.courseName().isBlank()) {
            opening.append(" (").append(overview.courseName()).append(")");
        }
        opening.append("\n\n");
        if (!overview.summary().isBlank()) {
            opening.append(overview.summary()).append("\n\n");
        } else {
            opening.append("Mình sẽ đồng hành như gia sư: cùng xem môn này dạy những gì, ")
                    .append("rồi học từng phần theo lộ trình.\n\n");
        }
        if (hasTopic) {
            opening.append("Hôm nay chúng ta bắt đầu với **").append(session.getTopic()).append("**.\n\n");
        }
        if (!hasLessons && overview.hasUnits()) {
            opening.append("### Nội dung chính trong chương trình học\n");
            overview.units().forEach(unit -> {
                opening.append("- **").append(unit.title()).append("**");
                if (!unit.detail().isBlank()) {
                    opening.append(": ").append(unit.detail());
                }
                opening.append("\n");
            });
            opening.append("\nChọn một phần ở thanh gợi ý để bắt đầu học — giống khi bạn nói *hôm nay mình học* chủ đề đó.");
            return opening.toString();
        }
        if (!suggestions.isEmpty()) {
            opening.append(hasLessons ? "### Gợi ý từ lộ trình của bạn\n" : "### Bắt đầu học một phần của môn\n");
            suggestions.forEach(topic -> opening.append("- ").append(topic).append("\n"));
            opening.append("\nChọn một gợi ý ở trên để học theo lộ trình, hoặc nhập chủ đề khác.");
        }
        return opening.toString();
    }

    private Map<String, Object> response(
            TutorSession session, String conversationId, AiMessage openingMessage, boolean resumed) {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("session", session);
        result.put("resumed", resumed);
        result.put("conversationId", conversationId != null && !conversationId.isBlank()
                ? conversationId
                : lastConversationId(session));
        result.put("openingMessage", openingPayload(openingMessage, session));
        result.put("turnLimit", 10);
        return result;
    }

    private TutorSession requireSession(String id) {
        return sessionRepository.findById(requireText(id, "sessionId"))
                .orElseThrow(() -> new IllegalArgumentException("Tutor session not found"));
    }

    private boolean isEffective(PedagogicalDirective directive) {
        LocalDateTime now = LocalDateTime.now();
        return (directive.getEffectiveFrom() == null || !directive.getEffectiveFrom().isAfter(now))
                && (directive.getEffectiveUntil() == null || directive.getEffectiveUntil().isAfter(now));
    }

    private List<String> firstNonEmpty(List<String> first, List<String> second, int size) {
        List<String> selected = first != null && !first.isEmpty() ? first : second;
        return limit(selected, size);
    }

    private List<String> limit(List<String> values, int size) {
        if (values == null) return List.of();
        return values.stream().filter(Objects::nonNull).filter(value -> !value.isBlank()).limit(size).toList();
    }

    private String trimToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }
}
