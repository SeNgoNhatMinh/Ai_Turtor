package com.ragapi.service;

import com.ragapi.dto.AiConversationSummary;
import com.ragapi.dto.OpenTutorSessionRequest;
import com.ragapi.dto.SuggestionItem;
import com.ragapi.dto.UpdateTutorSessionRequest;
import com.ragapi.entity.*;
import com.ragapi.repository.*;
import com.ragapi.util.LearningPathParser;
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

    public Map<String, Object> openOrResume(OpenTutorSessionRequest request) {
        if (request == null) throw new IllegalArgumentException("request is required");
        String studentId = requireText(request.getStudentId(), "studentId");
        String courseId = requireText(request.getCourseId(), "courseId");
        Optional<TutorSession> active = sessionRepository
                .findFirstByStudentIdAndCourseIdAndStatusOrderByUpdatedAtDesc(studentId, courseId, "ACTIVE");
        if (active.isPresent()) {
            return response(active.get(), null, null, true);
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
        session.getConversationIds().add(conversation.getConversationId());
        sessionRepository.save(session);
        String opening = buildOpening(session);
        AiMessage message = conversationService.appendProactiveAssistantMessage(
                conversation.getConversationId(), studentId, session.getId(), "OPEN", opening);
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
        return sessionRepository.save(session);
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
        LinkedHashSet<String> result = new LinkedHashSet<>();
        memoryRepository.findByStudentIdAndCourseId(studentId, courseId)
                .ifPresent(memory -> result.addAll(limit(memory.getWeakTopics(), 3)));
        try {
            chapterOutlineService.suggestChapters(courseId).stream()
                    .map(view -> view.getTitle())
                    .filter(Objects::nonNull)
                    .limit(4)
                    .forEach(result::add);
        } catch (Exception ignored) {
            // Opening remains available while chapter extraction is unavailable.
        }
        if (result.isEmpty()) result.add("Ôn lại nội dung gần nhất");
        return result.stream().limit(4).toList();
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
        StringBuilder opening = new StringBuilder("## Chào mừng bạn đến với buổi học ")
                .append(session.getCourseId()).append("\n\n")
                .append("Mình sẽ đồng hành như một gia sư: cùng chọn mục tiêu, giải thích theo từng bước, ")
                .append("cho bạn thực hành và tổng kết cuối buổi.\n\n");
        if (session.getTopic() != null) {
            opening.append("Hôm nay chúng ta bắt đầu với **").append(session.getTopic()).append("**.\n\n");
        } else {
            opening.append("Hôm nay bạn muốn học nội dung nào?\n\n");
        }
        opening.append("### Gợi ý từ lộ trình của bạn\n");
        session.getSuggestedTopics().forEach(topic -> opening.append("- ").append(topic).append("\n"));
        opening.append("\nBạn có thể chọn một gợi ý hoặc nhập chủ đề khác.");
        return opening.toString();
    }

    private Map<String, Object> response(
            TutorSession session, String conversationId, AiMessage openingMessage, boolean resumed) {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("session", session);
        result.put("resumed", resumed);
        result.put("conversationId", conversationId != null
                ? conversationId
                : session.getConversationIds().stream().reduce((first, second) -> second).orElse(""));
        result.put("openingMessage", openingMessage == null ? Map.of() : Map.of(
                "messageId", openingMessage.getId(),
                "role", openingMessage.getRole(),
                "content", openingMessage.getContent(),
                "proactive", true,
                "sessionPhase", session.getPhase()
        ));
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
