package com.ragapi.service.behavior;

import com.ragapi.entity.AppliedTeachingBehavior;
import com.ragapi.entity.StudentTeachingProfile;
import com.ragapi.entity.TeachingBehavior;
import com.ragapi.repository.TeachingBehaviorRepository;
import com.ragapi.service.EmbeddingService;
import com.ragapi.service.LlmIntentClassifierService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.*;

import static com.ragapi.entity.TeachingBehavior.*;
import static com.ragapi.service.behavior.BehaviorText.*;

/**
 * "Looks at the student" before the tutor answers: picks the behaviors from
 * the student's own RAG set and the shared library (course, domain, global)
 * that best fit this student's profile and the current question.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class TeachingBehaviorRetrievalService {
    public static final int MAX_BEHAVIORS = 5;
    public static final int MAX_RANKED = 3;
    static final double SIMILARITY_WEIGHT = 0.7;
    static final double SUCCESS_WEIGHT = 0.3;
    /** The student's own behaviors were chosen for them; prefer them over shared ones. */
    static final double PERSONAL_BONUS = 0.2;
    /** Shared behaviors must be at least this close to the student when embeddings are available. */
    static final double MIN_SHARED_COSINE = 0.35;

    private final TeachingBehaviorRepository repository;
    private final StudentTeachingProfileService profileService;
    private final TeachingBehaviorService behaviorService;
    private final AppliedTeachingBehaviorService appliedService;
    private final EmbeddingService embeddingService;

    public record ScoredBehavior(TeachingBehavior behavior, double score, String reason) {}

    public record TeachingGuidance(StudentTeachingProfile profile, List<ScoredBehavior> behaviors) {
        public static final TeachingGuidance EMPTY = new TeachingGuidance(null, List.of());

        public boolean isEmpty() {
            return StudentTeachingProfileService.isEmpty(profile) && behaviors.isEmpty();
        }

        public List<String> behaviorIds() {
            return behaviors.stream().map(item -> item.behavior().getId()).filter(Objects::nonNull).toList();
        }

        /** The prompt block appended to the tutor's pedagogical context. */
        public String promptBlock() {
            StringBuilder block = new StringBuilder();
            String profileText = StudentTeachingProfileService.profileText(profile);
            if (!profileText.isBlank()) {
                block.append("- STUDENT LEARNING PROFILE (choose examples and pacing for this student): ")
                        .append(profileText);
            }
            if (!behaviors.isEmpty()) {
                if (!block.isEmpty()) block.append("\n");
                block.append("""
                        STUDENT-SPECIFIC EXPLANATION STYLE (mandatory for this student in this course):
                        These items are styles for THIS answer, not new topics and not hidden homework.
                        Render each style that applies as its own numbered section from EXPLANATION STYLES.
                        Headings the student sees must be "## 1. ...", "## 2. ...", with no gaps.
                        Order: Giải thích khái niệm, Ví dụ thực tế, Minh họa trực quan, So sánh,
                        Bài tập có hướng dẫn, Tự thực hành.
                        If an item names an older concept, ignore that concept and use the style
                        on STUDENT QUESTION. Same course facts, different shape of the answer.
                        If the material does not cover the question, omit every style section.
                        Do not name this list to the student.
                        TEACHING BEHAVIORS TO APPLY:""");
                for (int index = 0; index < behaviors.size(); index++) {
                    block.append("\n  ").append(index + 1).append(". ")
                            .append(behaviors.get(index).behavior().getInstruction());
                }
            }
            return block.toString();
        }
    }

    public TeachingGuidance retrieve(String studentId, String courseId, String classId, String supportLevel,
                                     String question, String domain, boolean recordUsage) {
        if (trimToNull(studentId) == null || trimToNull(courseId) == null) return TeachingGuidance.EMPTY;
        String safeStudent = studentId.trim();
        String safeCourse = courseId.trim();
        try {
            StudentTeachingProfile profile = profileService.find(safeStudent, safeCourse).orElse(null);
            Set<String> blocked = new HashSet<>(profile == null ? List.of() : safe(profile.getBlockedBehaviorIds()));
            List<String> pinnedIds = profile == null ? List.of() : safe(profile.getPinnedBehaviorIds());

            List<ScoredBehavior> pinned = new ArrayList<>();
            Set<String> seen = new HashSet<>();
            if (!pinnedIds.isEmpty()) {
                Map<String, TeachingBehavior> byId = new HashMap<>();
                repository.findAllById(pinnedIds).forEach(behavior -> byId.put(behavior.getId(), behavior));
                for (String id : pinnedIds) {
                    TeachingBehavior behavior = byId.get(id);
                    if (behavior == null || blocked.contains(id) || !isActive(behavior)
                            || !StudentTeachingProfileService.appliesTo(behavior, safeStudent, safeCourse)) continue;
                    if (seen.add(id)) pinned.add(new ScoredBehavior(behavior, 1.0, "PINNED"));
                    if (pinned.size() >= MAX_BEHAVIORS) break;
                }
            }

            String queryText = String.join("\n", List.of(
                    StudentTeachingProfileService.profileText(profile), Objects.toString(question, ""))).trim();
            List<Float> questionEmbedding = embedQuestion(question);
            List<Float> profileEmbedding = profile == null ? null : profile.getProfileEmbedding();
            String level = trimToNull(supportLevel) == null ? "STANDARD" : supportLevel.trim().toUpperCase(Locale.ROOT);

            Map<String, AppliedTeachingBehavior> assigned = new LinkedHashMap<>();
            List<TeachingBehavior> pool = new ArrayList<>(assignmentCandidates(safeStudent, safeCourse, assigned));
            pool.addAll(candidates(safeStudent, safeCourse, domain));

            List<ScoredBehavior> ranked = new ArrayList<>();
            for (TeachingBehavior behavior : pool) {
                String id = behavior.getId();
                if (id == null || blocked.contains(id) || seen.contains(id)) continue;
                if (!isActive(behavior) || !matchesLevel(behavior, level)) continue;
                boolean personal = assigned.containsKey(id) || SCOPE_STUDENT.equals(behavior.getScope());
                Similarity similarity = similarityTo(behavior, queryText, questionEmbedding, profileEmbedding);
                if (!personal && !similarity.relevant()) continue;
                double score = SIMILARITY_WEIGHT * similarity.value()
                        + SUCCESS_WEIGHT * behavior.getSuccessRate()
                        + (personal ? PERSONAL_BONUS : 0.0)
                        + Math.max(-20, Math.min(20, behavior.getPriority())) * 0.01;
                String reason = assigned.containsKey(id) ? "ASSIGNED" : behavior.getScope();
                ranked.add(new ScoredBehavior(behavior, score, reason));
                seen.add(id);
            }
            ranked.sort(Comparator.comparingDouble(ScoredBehavior::score).reversed());

            List<ScoredBehavior> result = new ArrayList<>(pinned);
            for (ScoredBehavior item : ranked) {
                if (result.size() >= MAX_BEHAVIORS || result.size() - pinned.size() >= MAX_RANKED) break;
                result.add(item);
            }
            TeachingGuidance guidance = new TeachingGuidance(profile, List.copyOf(result));
            if (!guidance.behaviors().isEmpty()) {
                log.info("Applying {} teaching behavior(s) for student {} in {}: {}",
                        guidance.behaviors().size(), safeStudent, safeCourse,
                        guidance.behaviors().stream()
                                .map(item -> item.behavior().getInstruction())
                                .toList());
            }
            if (recordUsage) recordUsage(safeStudent, safeCourse, classId, guidance, assigned);
            return guidance;
        } catch (Exception error) {
            // Personalization must never block a tutor answer.
            log.warn("Teaching behavior retrieval failed for student {} in {}: {}",
                    safeStudent, safeCourse, error.getMessage());
            if (recordUsage) {
                recordFailure(safeStudent, safeCourse, classId, error.getMessage());
            }
            return TeachingGuidance.EMPTY;
        }
    }

    private List<TeachingBehavior> candidates(String studentId, String courseId, String domain) {
        List<TeachingBehavior> result = new ArrayList<>(repository.findByScopeAndStudentIdAndCourseIdAndStatusIn(
                SCOPE_STUDENT, studentId, courseId, List.of(STATUS_APPROVED)));
        result.addAll(repository.findTop500ByScopeAndCourseIdAndStatus(SCOPE_COURSE, courseId, STATUS_APPROVED));
        String safeDomain = trimToNull(domain) == null ? null : domain.trim().toUpperCase(Locale.ROOT);
        if (safeDomain != null && LlmIntentClassifierService.DOMAINS.contains(safeDomain)) {
            result.addAll(repository.findTop500ByScopeAndDomainAndStatus(SCOPE_DOMAIN, safeDomain, STATUS_APPROVED));
        }
        result.addAll(repository.findTop500ByScopeAndStatus(SCOPE_GLOBAL, STATUS_APPROVED));
        return result;
    }

    private record Similarity(double value, boolean relevant) {}

    private Similarity similarityTo(TeachingBehavior behavior, String queryText,
                                    List<Float> questionEmbedding, List<Float> profileEmbedding) {
        List<Float> embedding = behavior.getEmbedding();
        List<Double> cosines = new ArrayList<>();
        if (usable(questionEmbedding, embedding)) cosines.add(similarity(questionEmbedding, null, embedding, null));
        if (usable(profileEmbedding, embedding)) cosines.add(similarity(profileEmbedding, null, embedding, null));
        if (!cosines.isEmpty()) {
            double best = cosines.stream().mapToDouble(Double::doubleValue).max().orElse(0.0);
            return new Similarity(Math.max(0.0, best), best >= MIN_SHARED_COSINE);
        }
        double lexical = lexicalSimilarity(queryText, TeachingBehaviorService.embeddingText(behavior));
        return new Similarity(lexical, lexical > 0.0);
    }

    private static boolean usable(List<Float> left, List<Float> right) {
        return left != null && right != null && !left.isEmpty() && left.size() == right.size();
    }

    private List<Float> embedQuestion(String question) {
        if (trimToNull(question) == null) return null;
        try {
            // Memoized per request, so the RAG stage reuses this embedding.
            return embeddingService.generateQueryEmbedding(question.trim()).vectorAsList();
        } catch (Exception error) {
            return null;
        }
    }

    private List<TeachingBehavior> assignmentCandidates(String studentId, String courseId,
                                                       Map<String, AppliedTeachingBehavior> assigned) {
        List<TeachingBehavior> views = new ArrayList<>();
        for (AppliedTeachingBehavior assignment : appliedService.activeFor(studentId, courseId, java.time.LocalDateTime.now())) {
            if (assignment.getBehaviorId() == null) continue;
            TeachingBehavior template = repository.findById(assignment.getBehaviorId()).orElse(null);
            if (template == null || !isActive(template)) continue;
            AppliedTeachingBehavior previous = assigned.get(template.getId());
            if (previous != null && previous.getStudentId() != null && assignment.getStudentId() == null) continue;
            assigned.put(template.getId(), assignment);
            String instruction = assignment.getCustomizedInstructions() == null
                    || assignment.getCustomizedInstructions().isBlank()
                    ? template.getInstruction() : assignment.getCustomizedInstructions();
            int priority = assignment.getPriorityOverride() == null ? template.getPriority() : assignment.getPriorityOverride();
            views.add(TeachingBehavior.builder()
                    .id(template.getId())
                    .scope(template.getScope())
                    .courseId(template.getCourseId())
                    .strategy(template.getStrategy())
                    .instruction(instruction)
                    .supportLevels(template.getSupportLevels())
                    .status(template.getStatus())
                    .approvalStatus(template.getApprovalStatus())
                    .version(template.getVersion())
                    .priority(priority)
                    .successRate(template.getSuccessRate())
                    .embedding(template.getEmbedding())
                    .targetSignals(template.getTargetSignals())
                    .build());
        }
        return views;
    }

    private void recordUsage(String studentId, String courseId, String classId, TeachingGuidance guidance,
                             Map<String, AppliedTeachingBehavior> assigned) {
        try {
            if (!guidance.behaviorIds().isEmpty()) {
                behaviorService.recordUsage(guidance.behaviorIds());
                profileService.recordUsage(studentId, courseId, classId, guidance.behaviorIds());
            }
            List<AppliedTeachingBehaviorService.RetrievalSelection> selected = guidance.behaviors().stream()
                    .map(item -> {
                        AppliedTeachingBehavior assignment = assigned.get(item.behavior().getId());
                        return new AppliedTeachingBehaviorService.RetrievalSelection(
                                item.behavior().getId(),
                                item.behavior().getVersion(),
                                assignment == null ? null : assignment.getId(),
                                item.behavior().getStrategy(),
                                item.reason());
                    }).toList();
            appliedService.recordRetrieval(studentId, courseId, classId, selected, new ArrayList<>(assigned.values()));
        } catch (Exception error) {
            log.warn("Could not record teaching behavior usage: {}", error.getMessage());
        }
    }

    private void recordFailure(String studentId, String courseId, String classId, String reason) {
        try {
            appliedService.recordFailure(studentId, courseId, classId, reason);
        } catch (Exception ignored) {
            log.warn("Could not record teaching behavior failure: {}", ignored.getMessage());
        }
    }

    static boolean isActive(TeachingBehavior behavior) {
        if (behavior == null) return false;
        // Only teacher-approved strategies enter Active Teaching Context / tutor chat.
        return STATUS_APPROVED.equals(behavior.getStatus());
    }

    static boolean matchesLevel(TeachingBehavior behavior, String level) {
        List<String> levels = safe(behavior.getSupportLevels());
        return levels.isEmpty() || levels.contains(level);
    }
}
