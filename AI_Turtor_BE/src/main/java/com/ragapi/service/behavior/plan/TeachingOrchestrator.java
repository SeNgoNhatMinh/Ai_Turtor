package com.ragapi.service.behavior.plan;

import com.ragapi.entity.StudentTeachingProfile;
import com.ragapi.entity.TeachingBehavior;
import com.ragapi.entity.TeachingBehaviorExecution;
import com.ragapi.service.PedagogicalDirectiveService;
import com.ragapi.service.behavior.AppliedTeachingBehaviorService;
import com.ragapi.service.behavior.StudentTeachingProfileService;
import com.ragapi.service.behavior.TeachingBehaviorRetrievalService;
import com.ragapi.service.behavior.TeachingBehaviorRetrievalService.ScoredBehavior;
import com.ragapi.service.behavior.TeachingBehaviorRetrievalService.TeachingGuidance;
import com.ragapi.service.behavior.TeachingBehaviorService;
import com.ragapi.service.behavior.TeachingStrategyCatalog;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Objects;

/**
 * Resolves an immutable {@link TeachingPlan} for generating RAG teaching answers.
 * Retrieval never records APPLIED usage; callers commit after successful generation.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class TeachingOrchestrator {

    private final TeachingBehaviorRetrievalService behaviorRetrieval;
    private final PedagogicalDirectiveService directiveService;
    private final AppliedTeachingBehaviorService appliedService;
    private final TeachingBehaviorService behaviorService;
    private final StudentTeachingProfileService profileService;

    public TeachingPlan resolvePlan(
            String studentId,
            String courseId,
            String classId,
            String question,
            String domain,
            String teachingMode,
            String supportLevelOverride
    ) {
        String supportLevel = supportLevelOverride == null || supportLevelOverride.isBlank()
                ? directiveService.resolveSupportLevel(studentId, courseId, classId)
                : supportLevelOverride.trim().toUpperCase(Locale.ROOT);
        boolean teacherControlled = directiveService.hasTeacherControlledDirective(studentId, courseId, classId);
        List<String> teacherInstructions = extractTeacherInstructions(studentId, courseId, classId);

        TeachingGuidance guidance = TeachingGuidance.EMPTY;
        try {
            guidance = behaviorRetrieval.retrieve(
                    studentId, courseId, classId, supportLevel, question, domain, false);
        } catch (Exception error) {
            log.warn("Teaching plan retrieval failed for {} in {}: {}", studentId, courseId, error.getMessage());
        }

        StudentLearningProfileSnapshot profile = toProfile(guidance.profile());
        List<SelectedTeachingBehavior> selected = TeachingBehaviorConflictPolicy.resolve(
                toSelected(guidance.behaviors()));
        List<String> sections = requiredSections(selected);
        String pace = profile.pace();
        String depth = TeachingPlan.depthFor(supportLevel);
        String fingerprint = TeachingPlan.fingerprint(supportLevel, selected, pace, depth, sections);

        TeacherPolicySnapshot policy = new TeacherPolicySnapshot(
                supportLevel, teacherInstructions, teacherControlled);

        List<String> constraints = new ArrayList<>();
        constraints.add("Knowledge RAG facts outrank teaching style");
        if (teacherControlled) {
            constraints.add("Teacher policy outranks student preferences");
        }
        constraints.add("Do not invent course facts missing from material");

        return new TeachingPlan(
                studentId,
                courseId,
                classId,
                teachingMode,
                supportLevel,
                profile,
                selected,
                policy,
                depth,
                pace,
                sections,
                List.copyOf(constraints),
                fingerprint
        );
    }

    /** Prompt block for ACTIVE PEDAGOGICAL / style slots. Empty when nothing selected. */
    public String promptBlock(TeachingPlan plan) {
        if (plan == null) return "";
        StringBuilder block = new StringBuilder();
        StudentLearningProfileSnapshot profile = plan.learnerProfile();
        if (profile != null && !profile.isEmpty()) {
            block.append("- STUDENT LEARNING PROFILE (choose examples and pacing for this student): ");
            List<String> parts = new ArrayList<>();
            if (profile.learnsBestWith() != null && !profile.learnsBestWith().isEmpty()) {
                parts.add("learns best with " + String.join(", ", profile.learnsBestWith()));
            }
            if (profile.struggleSignals() != null && !profile.struggleSignals().isEmpty()) {
                parts.add("struggles with " + String.join(", ", profile.struggleSignals()));
            }
            if (profile.pace() != null && !profile.pace().isBlank()) {
                parts.add("pace " + profile.pace());
            }
            if (profile.teacherNote() != null && !profile.teacherNote().isBlank()) {
                parts.add("teacher note: " + profile.teacherNote());
            }
            block.append(String.join("; ", parts));
        }
        String activeStrategies = activeTeachingStrategiesBlock(plan);
        if (!activeStrategies.isBlank()) {
            if (!block.isEmpty()) block.append("\n");
            block.append(activeStrategies);
        } else if (plan.hasBehaviors()) {
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
            List<SelectedTeachingBehavior> behaviors = plan.selectedBehaviors();
            for (int index = 0; index < behaviors.size(); index++) {
                block.append("\n  ").append(index + 1).append(". ")
                        .append(behaviors.get(index).instruction());
            }
        }
        if (plan.teacherPolicy() != null && plan.teacherPolicy().instructions() != null) {
            for (String instruction : plan.teacherPolicy().instructions()) {
                if (instruction == null || instruction.isBlank()) continue;
                if (!block.isEmpty()) block.append("\n");
                block.append("- Teacher guidance: ").append(instruction);
            }
        }
        if (!block.isEmpty()) {
            String levelLine = "- ACTIVE SUPPORT LEVEL: " + plan.supportLevel()
                    + "\n- This support level is active for the student (set by a teacher or applied "
                    + "automatically by the AI Tutor from learning evidence). Apply it immediately; "
                    + "the student does not need to answer incorrectly first.";
            block.append("\n").append(levelLine);
        }
        return block.toString();
    }

    /**
     * Records SKIPPED for unused assignments and APPLIED for selected behaviors
     * after a successful generation that included the plan.
     */
    public void commitApplied(TeachingPlan plan) {
        commitApplied(plan, null);
    }

    public void commitApplied(TeachingPlan plan, String sessionId) {
        if (plan == null) return;
        try {
            List<AppliedTeachingBehaviorService.RetrievalSelection> selected = selections(plan);
            List<String> ids = selected.stream()
                    .map(AppliedTeachingBehaviorService.RetrievalSelection::behaviorId)
                    .filter(Objects::nonNull)
                    .toList();
            if (!ids.isEmpty()) {
                behaviorService.recordUsage(ids);
                profileService.recordUsage(plan.studentId(), plan.courseId(), plan.classId(), ids);
            }
            appliedService.recordRetrieval(
                    plan.studentId(), plan.courseId(), plan.classId(), sessionId,
                    selected,
                    appliedService.activeFor(plan.studentId(), plan.courseId(), LocalDateTime.now()),
                    TeachingBehaviorExecution.APPLIED);
            log.info("Committed teaching plan {} for student {} ({} applied)",
                    plan.planFingerprint(), plan.studentId(), selected.size());
        } catch (Exception error) {
            log.warn("Could not commit teaching plan usage: {}", error.getMessage());
        }
    }

    /**
     * Cache hit: never write APPLIED / never bump useCount. Selected behaviors are marked CACHE_HIT.
     */
    public void commitCacheHit(TeachingPlan plan, String sessionId) {
        if (plan == null || !plan.hasBehaviors()) return;
        try {
            appliedService.recordCacheHit(
                    plan.studentId(), plan.courseId(), plan.classId(), sessionId, selections(plan));
            log.info("Recorded CACHE_HIT for teaching plan {} student {}",
                    plan.planFingerprint(), plan.studentId());
        } catch (Exception error) {
            log.warn("Could not record teaching plan cache hit: {}", error.getMessage());
        }
    }

    public void commitFailed(TeachingPlan plan, String sessionId, String reason) {
        if (plan == null) return;
        try {
            appliedService.recordFailure(
                    plan.studentId(), plan.courseId(), plan.classId(), sessionId, reason);
        } catch (Exception error) {
            log.warn("Could not record teaching plan failure: {}", error.getMessage());
        }
    }

    private List<AppliedTeachingBehaviorService.RetrievalSelection> selections(TeachingPlan plan) {
        if (plan == null || !plan.hasBehaviors()) return List.of();
        return plan.selectedBehaviors().stream()
                .map(item -> new AppliedTeachingBehaviorService.RetrievalSelection(
                        item.behaviorId(),
                        item.behaviorVersion(),
                        item.appliedBehaviorId(),
                        item.strategy(),
                        item.selectionReason()))
                .toList();
    }

    /**
     * Builds the Active Teaching Context from teacher-approved catalog strategies
     * present on the plan. Unknown / free-text behaviors fall back to the legacy block.
     */
    private String activeTeachingStrategiesBlock(TeachingPlan plan) {
        if (plan == null || !plan.hasBehaviors()) return "";
        List<TeachingStrategyCatalog> catalogs = new ArrayList<>();
        for (SelectedTeachingBehavior item : plan.selectedBehaviors()) {
            TeachingStrategyCatalog catalog = TeachingStrategyCatalog.fromCode(item.strategyCode())
                    .or(() -> TeachingStrategyCatalog.fromLegacyLabel(item.strategy()))
                    .or(() -> TeachingStrategyCatalog.fromLegacyLabel(item.instruction()))
                    .orElse(null);
            if (catalog != null && !catalogs.contains(catalog)) {
                catalogs.add(catalog);
            }
        }
        return TeachingStrategyCatalog.activeContextBlock(catalogs);
    }

    private List<SelectedTeachingBehavior> toSelected(List<ScoredBehavior> scored) {
        if (scored == null || scored.isEmpty()) return List.of();
        List<SelectedTeachingBehavior> result = new ArrayList<>();
        for (ScoredBehavior item : scored) {
            TeachingBehavior behavior = item.behavior();
            if (behavior == null || behavior.getId() == null) continue;
            result.add(new SelectedTeachingBehavior(
                    behavior.getId(),
                    behavior.getVersion(),
                    null,
                    behavior.getStrategy(),
                    behavior.getStrategyCode(),
                    behavior.getInstruction(),
                    behavior.getPriority(),
                    item.score(),
                    item.reason()
            ));
        }
        return result;
    }

    private StudentLearningProfileSnapshot toProfile(StudentTeachingProfile profile) {
        if (profile == null) return StudentLearningProfileSnapshot.EMPTY;
        return new StudentLearningProfileSnapshot(
                profile.getLearnsBestWith() == null ? List.of() : List.copyOf(profile.getLearnsBestWith()),
                profile.getStruggleSignals() == null ? List.of() : List.copyOf(profile.getStruggleSignals()),
                profile.getPace(),
                profile.getTeacherNote()
        );
    }

    private List<String> requiredSections(List<SelectedTeachingBehavior> selected) {
        LinkedSections sections = new LinkedSections();
        for (SelectedTeachingBehavior item : selected) {
            String strategy = item.strategy() == null ? "" : item.strategy().toLowerCase(Locale.ROOT);
            String instruction = item.instruction() == null ? "" : item.instruction().toLowerCase(Locale.ROOT);
            if (strategy.contains("khái niệm") || instruction.contains("khái niệm")) sections.add("CONCEPT");
            if (strategy.contains("ví dụ") || instruction.contains("ví dụ")) sections.add("REAL_WORLD_EXAMPLE");
            if (strategy.contains("minh họa") || instruction.contains("sơ đồ")) sections.add("VISUAL_DIAGRAM");
            if (strategy.contains("so sánh") || instruction.contains("so sánh")) sections.add("COMPARISON");
            if (strategy.contains("bài tập") || instruction.contains("hướng dẫn")) sections.add("GUIDED_PRACTICE");
            if (strategy.contains("tự") || instruction.contains("kiểm tra")) sections.add("SELF_CHECK");
        }
        return sections.toList();
    }

    private List<String> extractTeacherInstructions(String studentId, String courseId, String classId) {
        // Directive text is already available via resolveTutorGuidance(3-arg); keep plan light.
        String context = directiveService.resolveTutorGuidance(studentId, courseId, classId).tutorContext();
        if (context == null || context.isBlank()) return List.of();
        List<String> lines = new ArrayList<>();
        for (String line : context.split("\n")) {
            String trimmed = line.trim();
            if (trimmed.startsWith("- Teacher guidance:")) {
                lines.add(trimmed.substring("- Teacher guidance:".length()).trim());
            }
        }
        return List.copyOf(lines);
    }

    private static final class LinkedSections {
        private final List<String> values = new ArrayList<>();

        void add(String value) {
            if (!values.contains(value)) values.add(value);
        }

        List<String> toList() {
            return List.copyOf(values);
        }
    }
}
