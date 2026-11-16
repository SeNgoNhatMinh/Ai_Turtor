package com.ragapi.service.behavior.plan;

import com.ragapi.entity.LearningEvidence;
import com.ragapi.entity.StudentCourseMemory;
import com.ragapi.entity.StudentWeakTopic;
import com.ragapi.service.LearningEvidenceService;
import com.ragapi.service.StudentCourseMemoryService;
import com.ragapi.util.LearnerAffectDetector;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Builds a compact, topic-relevant {@link StudentLearningContext} for one tutor turn.
 * Does not invent profiles; empty history yields an empty prompt block.
 */
@Service
@RequiredArgsConstructor
public class StudentLearningContextService {

    private static final int MAX_GAPS = 4;
    private static final int MAX_STRENGTHS = 4;
    private static final int MAX_PROGRESS = 3;
    private static final int MAX_ASSESSMENTS = 5;
    private static final int EVIDENCE_LOOKBACK_DAYS = 45;

    private final StudentCourseMemoryService memoryService;
    private final LearningEvidenceService learningEvidenceService;

    public StudentLearningContext resolve(
            String studentId,
            String courseId,
            String classId,
            String question,
            String sessionTopic,
            String recentHistory,
            String understandingSignals
    ) {
        if (isBlank(studentId) || isBlank(courseId)) {
            return StudentLearningContext.EMPTY;
        }
        String topicHint = firstNonBlank(sessionTopic, extractTopicHint(question));
        StudentCourseMemory memory = memoryService.findMemory(studentId.trim(), courseId.trim()).orElse(null);

        List<String> gaps = topicFilter(weakTopics(memory), topicHint, question, MAX_GAPS);
        List<String> strengths = topicFilter(safeList(memory == null ? null : memory.getLearnedTopics()),
                topicHint, question, MAX_STRENGTHS);
        List<String> misconceptions = topicFilter(struggleFromWeakDetails(memory), topicHint, question, MAX_GAPS);
        List<String> progress = topicFilter(safeList(memory == null ? null : memory.getRecentQuestions()),
                topicHint, question, MAX_PROGRESS);

        List<LearningEvidence> evidence = learningEvidenceService.listRecentForStudentCourse(
                studentId, courseId, EVIDENCE_LOOKBACK_DAYS);
        List<String> assessmentSignals = evidence.stream()
                .filter(item -> topicRelevant(item.getTopic(), topicHint, question))
                .limit(MAX_ASSESSMENTS)
                .map(this::formatAssessment)
                .filter(line -> !line.isBlank())
                .toList();

        // Stale gaps that later assessments show as strong get demoted.
        Set<String> resolved = evidence.stream()
                .filter(item -> item.getPercentage() != null && item.getPercentage() >= 70.0)
                .map(LearningEvidence::getTopic)
                .filter(Objects::nonNull)
                .map(value -> value.toLowerCase(Locale.ROOT))
                .collect(Collectors.toCollection(LinkedHashSet::new));
        gaps = gaps.stream()
                .filter(gap -> resolved.stream().noneMatch(topic -> topicContains(gap, topic) || topicContains(topic, gap)))
                .toList();

        String affect = LearnerAffectDetector.detect(question, recentHistory, understandingSignals);
        String prompt = buildPromptBlock(
                topicHint, gaps, misconceptions, strengths, progress, assessmentSignals, affect);
        return new StudentLearningContext(
                studentId.trim(),
                courseId.trim(),
                classId,
                topicHint,
                List.copyOf(gaps),
                List.copyOf(misconceptions),
                List.copyOf(strengths),
                List.copyOf(progress),
                List.copyOf(assessmentSignals),
                affect,
                prompt
        );
    }

    private String buildPromptBlock(
            String topic,
            List<String> gaps,
            List<String> misconceptions,
            List<String> strengths,
            List<String> progress,
            List<String> assessments,
            String affect
    ) {
        List<String> lines = new ArrayList<>();
        lines.add("STUDENT LEARNING CONTEXT (personalization only — not a factual course source):");
        if (!isBlank(topic)) {
            lines.add("- Current topic focus: " + topic);
        }
        append(lines, "Relevant unresolved difficulties", gaps);
        append(lines, "Repeated misconceptions to address differently", misconceptions);
        append(lines, "Demonstrated strengths on related topics", strengths);
        append(lines, "Recent related student questions", progress);
        append(lines, "Recent verified assessment signals", assessments);
        if (affect != null && !"NEUTRAL".equalsIgnoreCase(affect) && !"UNKNOWN".equalsIgnoreCase(affect)) {
            lines.add("- Temporary interaction signal (uncertain, tone only): " + affect
                    + ". Adapt patience/pacing; never judge ability from this signal.");
        }
        if (lines.size() <= 1) {
            return "";
        }
        lines.add("- Use this context to adapt HOW you explain. COURSE MATERIAL CONTEXT remains the only "
                + "authority for course facts. Do not invent a lasting profile from weak evidence.");
        return String.join("\n", lines);
    }

    private List<String> weakTopics(StudentCourseMemory memory) {
        if (memory == null) return List.of();
        LinkedHashSet<String> values = new LinkedHashSet<>();
        safeList(memory.getWeakTopics()).forEach(values::add);
        if (memory.getWeakTopicDetails() != null) {
            for (StudentWeakTopic detail : memory.getWeakTopicDetails()) {
                if (detail == null) continue;
                if (!isBlank(detail.getCanonicalTopic())) values.add(detail.getCanonicalTopic().trim());
            }
        }
        return List.copyOf(values);
    }

    private List<String> struggleFromWeakDetails(StudentCourseMemory memory) {
        if (memory == null || memory.getWeakTopicDetails() == null) return List.of();
        List<String> result = new ArrayList<>();
        for (StudentWeakTopic detail : memory.getWeakTopicDetails()) {
            if (detail == null || isBlank(detail.getCanonicalTopic())) continue;
            String origin = detail.getOrigin() == null ? "" : detail.getOrigin().trim();
            if (origin.toUpperCase(Locale.ROOT).contains("MISCONCEPT")
                    || origin.toLowerCase(Locale.ROOT).contains("nhầm")
                    || origin.toLowerCase(Locale.ROOT).contains("sai")) {
                result.add(detail.getCanonicalTopic().trim()
                        + (origin.isBlank() ? "" : " (" + origin + ")"));
            }
        }
        return result;
    }

    private String formatAssessment(LearningEvidence evidence) {
        if (evidence == null) return "";
        String topic = isBlank(evidence.getTopic()) ? "topic" : evidence.getTopic().trim();
        String pct = evidence.getPercentage() == null
                ? "?"
                : String.format(Locale.ROOT, "%.0f%%", evidence.getPercentage());
        String outcome = evidence.getPercentage() == null
                ? "recorded"
                : evidence.getPercentage() >= 70.0 ? "demonstrated" : "struggled";
        return topic + " → " + outcome + " (" + pct + ")";
    }

    private List<String> topicFilter(List<String> values, String topicHint, String question, int limit) {
        if (values == null || values.isEmpty()) return List.of();
        List<String> relevant = new ArrayList<>();
        List<String> fallback = new ArrayList<>();
        for (String value : values) {
            if (isBlank(value)) continue;
            if (topicRelevant(value, topicHint, question)) {
                relevant.add(value.trim());
            } else {
                fallback.add(value.trim());
            }
            if (relevant.size() >= limit) break;
        }
        if (!relevant.isEmpty()) {
            return relevant.stream().limit(limit).toList();
        }
        // No topic match: keep a tiny global sample so empty-profile students stay empty only when memory is empty.
        return fallback.stream().limit(Math.min(2, limit)).toList();
    }

    static boolean topicRelevant(String candidate, String topicHint, String question) {
        if (isBlank(candidate)) return false;
        if (isBlank(topicHint) && isBlank(question)) return true;
        String hay = ((topicHint == null ? "" : topicHint) + " " + (question == null ? "" : question))
                .toLowerCase(Locale.ROOT);
        String needle = candidate.toLowerCase(Locale.ROOT);
        if (hay.contains(needle) || needle.contains(hay.trim())) return true;
        for (String token : needle.split("[\\s,/|;]+")) {
            if (token.length() < 4) continue;
            if (hay.contains(token)) return true;
        }
        return false;
    }

    private static boolean topicContains(String left, String right) {
        if (isBlank(left) || isBlank(right)) return false;
        return left.toLowerCase(Locale.ROOT).contains(right.toLowerCase(Locale.ROOT));
    }

    private static void append(List<String> lines, String label, List<String> values) {
        if (values == null || values.isEmpty()) return;
        lines.add("- " + label + ": " + String.join("; ", values));
    }

    private static List<String> safeList(List<String> values) {
        return values == null ? List.of() : values;
    }

    private static String extractTopicHint(String question) {
        if (isBlank(question)) return null;
        String trimmed = question.trim().replaceAll("\\s+", " ");
        return trimmed.length() <= 80 ? trimmed : trimmed.substring(0, 80);
    }

    private static String firstNonBlank(String... values) {
        if (values == null) return null;
        for (String value : values) {
            if (!isBlank(value)) return value.trim();
        }
        return null;
    }

    private static boolean isBlank(String value) {
        return value == null || value.isBlank();
    }
}
