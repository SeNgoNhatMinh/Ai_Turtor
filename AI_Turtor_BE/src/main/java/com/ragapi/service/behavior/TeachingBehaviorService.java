package com.ragapi.service.behavior;

import com.ragapi.dto.TeachingBehaviorRequest;
import com.ragapi.entity.AdaptiveLearningReview;
import com.ragapi.entity.ClassSection;
import com.ragapi.entity.TeachingBehavior;
import com.ragapi.entity.TeachingBehaviorVersion;
import com.ragapi.repository.TeachingBehaviorRepository;
import com.ragapi.repository.TeachingBehaviorVersionRepository;
import com.ragapi.service.AccessGuardService;
import com.ragapi.service.EmbeddingService;
import com.ragapi.service.LlmIntentClassifierService;
import com.ragapi.service.PedagogicalDirectiveService;
import com.ragapi.service.PrivacySanitizer;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.*;
import java.util.regex.Pattern;

import static com.ragapi.entity.TeachingBehavior.*;
import static com.ragapi.service.behavior.BehaviorText.*;

/**
 * The shared "RAG behavior" library: CRUD with scope-aware permissions,
 * the review lifecycle (AI_PENDING while a review waits, APPROVED/REJECTED
 * after the teacher decides) and usage/outcome bookkeeping.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class TeachingBehaviorService {
    public static final Set<String> SCOPES = Set.of(SCOPE_STUDENT, SCOPE_COURSE, SCOPE_DOMAIN, SCOPE_GLOBAL);
    public static final Set<String> STATUSES = Set.of(
            STATUS_AI_PENDING, STATUS_APPROVED, STATUS_REJECTED, STATUS_RETIRED);
    public static final Set<String> SUPPORT_LEVELS = Set.of("HIGH_SUPPORT", "STANDARD", "CHALLENGE");
    public static final int MAX_INSTRUCTION_LENGTH = 500;
    static final double DUPLICATE_SIMILARITY = 0.9;
    static final int RATE_WINDOW = 20;
    static final int RETIRE_MIN_OUTCOMES = 10;
    static final double RETIRE_BELOW_RATE = 0.3;

    private final TeachingBehaviorRepository repository;
    private final TeachingBehaviorVersionRepository versionRepository;
    private final MongoTemplate mongoTemplate;
    private final EmbeddingService embeddingService;
    private final PrivacySanitizer privacySanitizer;
    private final AccessGuardService accessGuard;

    // ------------------------------------------------------------------ CRUD

    public TeachingBehavior get(String id, BehaviorActor actor) {
        TeachingBehavior behavior = require(id);
        if (!canView(behavior, actor)) throw new BehaviorAccessDeniedException("Không có quyền xem hành vi này");
        return behavior;
    }

    public Map<String, Object> list(String scope, String courseId, String domain, String status,
                                    String keyword, int page, int size, BehaviorActor actor) {
        int safePage = Math.max(0, page);
        int safeSize = Math.max(1, Math.min(100, size));
        List<Criteria> filters = new ArrayList<>();
        String safeScope = upper(scope);
        if (safeScope != null) filters.add(Criteria.where("scope").is(requireScope(safeScope)));
        if (trimToNull(courseId) != null) filters.add(Criteria.where("courseId").is(courseId.trim()));
        if (upper(domain) != null) filters.add(Criteria.where("domain").is(upper(domain)));
        String safeStatus = upper(status);
        if (safeStatus != null) {
            if (!STATUSES.contains(safeStatus)) throw new IllegalArgumentException("Trạng thái không hợp lệ");
            filters.add(Criteria.where("status").is(safeStatus));
        }
        if (trimToNull(keyword) != null) {
            String pattern = Pattern.quote(keyword.trim());
            filters.add(new Criteria().orOperator(
                    Criteria.where("instruction").regex(pattern, "i"),
                    Criteria.where("name").regex(pattern, "i"),
                    Criteria.where("strategy").regex(pattern, "i")));
        }
        if (!actor.isAdmin()) filters.add(visibilityCriteria(actor));

        Query query = new Query();
        if (!filters.isEmpty()) query.addCriteria(new Criteria().andOperator(filters.toArray(new Criteria[0])));
        long total = mongoTemplate.count(query, TeachingBehavior.class);
        query.with(Sort.by(Sort.Direction.DESC, "updatedAt")).skip((long) safePage * safeSize).limit(safeSize);
        List<TeachingBehavior> items = mongoTemplate.find(query, TeachingBehavior.class);
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("items", items);
        result.put("totalElements", total);
        result.put("page", safePage);
        result.put("size", safeSize);
        result.put("totalPages", (int) Math.ceil(total / (double) safeSize));
        return result;
    }

    public TeachingBehavior create(TeachingBehaviorRequest request, BehaviorActor actor) {
        if (request == null) throw new IllegalArgumentException("Thiếu nội dung hành vi");
        String scope = requireScope(upper(request.getScope()));
        String studentId = SCOPE_STUDENT.equals(scope) ? requireField(request.getStudentId(), "studentId") : null;
        String courseId = Set.of(SCOPE_STUDENT, SCOPE_COURSE).contains(scope)
                ? requireField(request.getCourseId(), "courseId") : null;
        String classId = SCOPE_STUDENT.equals(scope) ? trimToNull(request.getClassId()) : null;
        String domain = SCOPE_DOMAIN.equals(scope) ? requireDomain(request.getDomain()) : null;
        requireCreatePermission(scope, studentId, courseId, classId, actor);

        String instruction = cleanInstruction(request.getInstruction(), scope, List.of());
        TeachingBehavior draft = TeachingBehavior.builder()
                .scope(scope)
                .studentId(studentId)
                .courseId(courseId)
                .classId(classId)
                .domain(domain)
                .name(cleanOptional(request.getName(), 120))
                .description(cleanOptional(request.getDescription(), 500))
                .strategy(cleanStrategy(request.getStrategy(), instruction))
                .applicableTopics(cleanList(request.getApplicableTopics(), 12, 80))
                .applicabilityConditions(cleanOptional(request.getApplicabilityConditions(), 300))
                .priority(request.getPriority() == null ? 0 : request.getPriority())
                .version(1)
                .approvalStatus(APPROVAL_APPROVED)
                .supportLevels(normalizeLevels(request.getSupportLevels()))
                .instruction(instruction)
                .targetSignals(cleanList(request.getTargetSignals(), 10, 120))
                .status(STATUS_APPROVED)
                .createdBy(actor.id())
                .createdByName(trimToNull(actor.name()))
                .updatedBy(actor.id())
                .build();
        return saveDeduplicated(draft);
    }

    public TeachingBehavior update(String id, TeachingBehaviorRequest request, BehaviorActor actor) {
        if (request == null) throw new IllegalArgumentException("Thiếu nội dung hành vi");
        TeachingBehavior behavior = require(id);
        requireEditPermission(behavior, actor);
        snapshot(behavior, actor.id());
        if (request.getName() != null) behavior.setName(cleanOptional(request.getName(), 120));
        if (request.getDescription() != null) behavior.setDescription(cleanOptional(request.getDescription(), 500));
        if (request.getStrategy() != null) behavior.setStrategy(cleanStrategy(request.getStrategy(), behavior.getInstruction()));
        if (request.getApplicableTopics() != null) {
            behavior.setApplicableTopics(cleanList(request.getApplicableTopics(), 12, 80));
        }
        if (request.getApplicabilityConditions() != null) {
            behavior.setApplicabilityConditions(cleanOptional(request.getApplicabilityConditions(), 300));
        }
        if (request.getPriority() != null) behavior.setPriority(request.getPriority());
        if (request.getInstruction() != null) {
            behavior.setInstruction(cleanInstruction(request.getInstruction(), behavior.getScope(), List.of()));
        }
        if (request.getTargetSignals() != null) {
            behavior.setTargetSignals(cleanList(request.getTargetSignals(), 10, 120));
        }
        if (request.getSupportLevels() != null) {
            behavior.setSupportLevels(normalizeLevels(request.getSupportLevels()));
        }
        if (SCOPE_DOMAIN.equals(behavior.getScope()) && trimToNull(request.getDomain()) != null) {
            behavior.setDomain(requireDomain(request.getDomain()));
        }
        // A teacher editing an AI suggestion takes ownership of it.
        if (STATUS_AI_PENDING.equals(behavior.getStatus())) {
            behavior.setStatus(STATUS_APPROVED);
            behavior.setApprovalStatus(APPROVAL_APPROVED);
        }
        behavior.setVersion(Math.max(1, behavior.getVersion()) + 1);
        behavior.setUpdatedBy(actor.id());
        behavior.setEmbedding(embed(embeddingText(behavior)));
        behavior.setUpdatedAt(LocalDateTime.now());
        return repository.save(behavior);
    }

    public TeachingBehavior setStatus(String id, String status, BehaviorActor actor) {
        String safeStatus = upper(status);
        if (!Set.of(STATUS_APPROVED, STATUS_RETIRED).contains(safeStatus)) {
            throw new IllegalArgumentException("Chỉ có thể bật lại hoặc ngừng dùng hành vi");
        }
        TeachingBehavior behavior = require(id);
        requireEditPermission(behavior, actor);
        behavior.setStatus(safeStatus);
        behavior.setUpdatedAt(LocalDateTime.now());
        return repository.save(behavior);
    }

    public TeachingBehavior retire(String id, BehaviorActor actor) {
        return setStatus(id, STATUS_RETIRED, actor);
    }

    // ------------------------------------------------------ review lifecycle

    /**
     * Turns a fresh review's recommendations into AI_PENDING behaviors for the
     * student so the tutor applies them while the teacher has not decided yet.
     * Older AI_PENDING behaviors of the same student/course are superseded.
     */
    public List<TeachingBehavior> createPendingFromReview(AdaptiveLearningReview review) {
        if (review == null || trimToNull(review.getStudentId()) == null || trimToNull(review.getCourseId()) == null) {
            return List.of();
        }
        LocalDateTime now = LocalDateTime.now();
        repository.findByScopeAndStudentIdAndCourseIdAndStatusIn(
                        SCOPE_STUDENT, review.getStudentId(), review.getCourseId(), List.of(STATUS_AI_PENDING))
                .forEach(previous -> {
                    previous.setStatus(STATUS_RETIRED);
                    previous.setUpdatedAt(now);
                    repository.save(previous);
                });
        List<String> signals = reviewSignals(review);
        List<String> levels = review.getSuggestedSupportLevel() == null
                ? List.of() : normalizeLevels(List.of(review.getSuggestedSupportLevel()));
        List<TeachingBehavior> created = new ArrayList<>();
        if (review.getStrategyRecommendations() != null && !review.getStrategyRecommendations().isEmpty()) {
            for (var recommendation : review.getStrategyRecommendations()) {
                TeachingStrategyCatalog catalog = TeachingStrategyCatalog.fromCode(recommendation.getStrategyCode())
                        .orElse(null);
                if (catalog == null) continue;
                String instruction = catalog.displayName() + ": "
                        + (recommendation.getReason() == null || recommendation.getReason().isBlank()
                        ? catalog.shortDescription() : recommendation.getReason().trim());
                if (instruction.length() > MAX_INSTRUCTION_LENGTH) {
                    instruction = instruction.substring(0, MAX_INSTRUCTION_LENGTH);
                }
                TeachingBehavior behavior = TeachingBehavior.builder()
                        .id(UUID.randomUUID().toString())
                        .scope(SCOPE_STUDENT)
                        .studentId(review.getStudentId())
                        .courseId(review.getCourseId())
                        .classId(trimToNull(review.getClassId()))
                        .supportLevels(levels)
                        .name(catalog.displayName())
                        .strategy(catalog.displayName())
                        .strategyCode(catalog.code())
                        .instruction(instruction)
                        .description(recommendation.getTargetLearningProblem())
                        .targetSignals(signals)
                        .version(1)
                        .approvalStatus(APPROVAL_PENDING)
                        .status(STATUS_AI_PENDING)
                        .sourceReviewId(review.getId())
                        .createdBy(PedagogicalDirectiveService.AI_ACTOR_ID)
                        .createdByName("AI Tutor (tự động)")
                        .createdAt(now)
                        .updatedAt(now)
                        .build();
                behavior.setEmbedding(embed(embeddingText(behavior)));
                created.add(repository.save(behavior));
            }
            return created;
        }
        List<String> recommendations = cleanList(review.getTeachingRecommendations(), 8, MAX_INSTRUCTION_LENGTH);
        for (String recommendation : recommendations) {
            TeachingStrategyCatalog catalog = TeachingStrategyCatalog.fromLegacyLabel(recommendation).orElse(null);
            TeachingBehavior behavior = TeachingBehavior.builder()
                    .id(UUID.randomUUID().toString())
                    .scope(SCOPE_STUDENT)
                    .studentId(review.getStudentId())
                    .courseId(review.getCourseId())
                    .classId(trimToNull(review.getClassId()))
                    .supportLevels(levels)
                    .name(catalog == null ? ExplanationStyles.strategyOf(recommendation) : catalog.displayName())
                    .strategy(catalog == null ? ExplanationStyles.strategyOf(recommendation) : catalog.displayName())
                    .strategyCode(catalog == null ? null : catalog.code())
                    .instruction(recommendation)
                    .targetSignals(signals)
                    .version(1)
                    .approvalStatus(APPROVAL_PENDING)
                    .status(STATUS_AI_PENDING)
                    .sourceReviewId(review.getId())
                    .createdBy(PedagogicalDirectiveService.AI_ACTOR_ID)
                    .createdByName("AI Tutor (tự động)")
                    .createdAt(now)
                    .updatedAt(now)
                    .build();
            behavior.setEmbedding(embed(embeddingText(behavior)));
            created.add(repository.save(behavior));
        }
        return created;
    }

    /**
     * Applies the teacher's checkbox choice: checked AI suggestions become
     * APPROVED, unchecked ones REJECTED, and the "Khác" text becomes a new
     * APPROVED behavior. {@code selected == null} keeps every suggestion.
     */
    public List<TeachingBehavior> approveReviewBehaviors(AdaptiveLearningReview review, List<String> selected,
                                                         String customStrategy, BehaviorActor actor) {
        LocalDateTime now = LocalDateTime.now();
        Set<String> selectedKeys = new HashSet<>();
        List<String> selectedTexts = selected == null
                ? safe(review.getTeachingRecommendations()) : selected;
        selectedTexts.forEach(text -> {
            selectedKeys.add(normalizedKey(text));
            if (TeachingStrategyCatalog.isKnown(text)) {
                selectedKeys.add(text.trim().toUpperCase(Locale.ROOT));
            }
        });

        List<TeachingBehavior> approved = new ArrayList<>();
        Set<String> coveredKeys = new HashSet<>();
        for (TeachingBehavior behavior : repository.findBySourceReviewId(review.getId())) {
            if (!SCOPE_STUDENT.equals(behavior.getScope())) continue;
            if (!Set.of(STATUS_AI_PENDING, STATUS_RETIRED).contains(behavior.getStatus())
                    || !PedagogicalDirectiveService.AI_ACTOR_ID.equals(behavior.getCreatedBy())) {
                continue;
            }
            String key = normalizedKey(behavior.getInstruction());
            String code = behavior.getStrategyCode() == null
                    ? "" : behavior.getStrategyCode().trim().toUpperCase(Locale.ROOT);
            boolean keep = selectedKeys.contains(key) || (!code.isEmpty() && selectedKeys.contains(code));
            behavior.setStatus(keep ? STATUS_APPROVED : STATUS_REJECTED);
            behavior.setApprovalStatus(keep ? APPROVAL_APPROVED : APPROVAL_REJECTED);
            behavior.setUpdatedAt(now);
            TeachingBehavior saved = repository.save(behavior);
            if (keep) {
                approved.add(saved);
                coveredKeys.add(key);
                if (!code.isEmpty()) coveredKeys.add(code);
            }
        }
        // Reviews created before the library existed have no AI_PENDING rows yet.
        for (String text : cleanList(selectedTexts, 8, MAX_INSTRUCTION_LENGTH)) {
            if (coveredKeys.contains(normalizedKey(text))) continue;
            approved.add(saveReviewBehavior(review, text, actor, now));
        }
        String custom = trimToNull(customStrategy);
        if (custom != null) {
            approved.add(saveReviewBehavior(review, cleanInstruction(custom, SCOPE_STUDENT, List.of()), actor, now));
        }
        return approved;
    }

    /** Rejecting a review removes every strategy it introduced. */
    public void rejectReviewBehaviors(String reviewId) {
        if (trimToNull(reviewId) == null) return;
        LocalDateTime now = LocalDateTime.now();
        for (TeachingBehavior behavior : repository.findBySourceReviewId(reviewId)) {
            if (!SCOPE_STUDENT.equals(behavior.getScope())) continue;
            if (STATUS_REJECTED.equals(behavior.getStatus())) continue;
            behavior.setStatus(STATUS_REJECTED);
            behavior.setApprovalStatus(APPROVAL_REJECTED);
            behavior.setUpdatedAt(now);
            repository.save(behavior);
        }
    }

    /** Copies chosen student behaviors to a wider scope, stripping student identity first. */
    public List<TeachingBehavior> shareBehaviors(List<TeachingBehavior> behaviors, String scope, String domain,
                                                 String courseId, List<String> namesToStrip, BehaviorActor actor) {
        String safeScope = upper(scope);
        if (safeScope == null || behaviors == null || behaviors.isEmpty()) return List.of();
        if (SCOPE_STUDENT.equals(requireScope(safeScope))) return List.of();
        String safeCourse = SCOPE_COURSE.equals(safeScope) ? requireField(courseId, "courseId") : null;
        String safeDomain = SCOPE_DOMAIN.equals(safeScope) ? requireDomain(domain) : null;
        requireCreatePermission(safeScope, null, safeCourse, null, actor);
        List<TeachingBehavior> shared = new ArrayList<>();
        for (TeachingBehavior source : behaviors) {
            TeachingBehavior copy = TeachingBehavior.builder()
                    .scope(safeScope)
                    .courseId(safeCourse)
                    .domain(safeDomain)
                    .supportLevels(new ArrayList<>(safe(source.getSupportLevels())))
                    .instruction(cleanInstruction(source.getInstruction(), safeScope, namesToStrip))
                    .targetSignals(safe(source.getTargetSignals()).stream()
                            .map(signal -> stripSharedText(signal, namesToStrip)).toList())
                    .status(STATUS_APPROVED)
                    .sourceBehaviorId(source.getId())
                    .sourceReviewId(source.getSourceReviewId())
                    .createdBy(actor.id())
                    .createdByName(trimToNull(actor.name()))
                    .build();
            shared.add(saveDeduplicated(copy));
        }
        return shared;
    }

    // -------------------------------------------------- usage and outcomes

    public void recordUsage(Collection<String> behaviorIds) {
        if (behaviorIds == null || behaviorIds.isEmpty()) return;
        mongoTemplate.updateMulti(
                Query.query(Criteria.where("_id").in(behaviorIds)),
                new Update().inc("useCount", 1).set("lastUsedAt", LocalDateTime.now()),
                TeachingBehavior.class);
    }

    /**
     * Moving-average success rate over the last {@link #RATE_WINDOW} outcomes.
     * Approved behaviors that keep failing are retired automatically; a
     * teacher can turn them back on from the library.
     */
    public void recordOutcome(Collection<String> behaviorIds, boolean success) {
        if (behaviorIds == null || behaviorIds.isEmpty()) return;
        LocalDateTime now = LocalDateTime.now();
        for (TeachingBehavior behavior : repository.findAllById(new LinkedHashSet<>(behaviorIds))) {
            int outcomes = behavior.getOutcomeCount() + 1;
            double rate = behavior.getSuccessRate();
            rate += ((success ? 1.0 : 0.0) - rate) / Math.min(outcomes, RATE_WINDOW);
            behavior.setOutcomeCount(outcomes);
            behavior.setSuccessRate(Math.max(0.0, Math.min(1.0, rate)));
            if (STATUS_APPROVED.equals(behavior.getStatus())
                    && outcomes >= RETIRE_MIN_OUTCOMES && behavior.getSuccessRate() < RETIRE_BELOW_RATE) {
                behavior.setStatus(STATUS_RETIRED);
                log.info("Teaching behavior {} retired after {} outcomes (successRate={})",
                        behavior.getId(), outcomes, behavior.getSuccessRate());
            }
            behavior.setUpdatedAt(now);
            repository.save(behavior);
        }
    }

    // ---------------------------------------------------------- permissions

    public boolean canView(TeachingBehavior behavior, BehaviorActor actor) {
        if (actor.isAdmin()) return true;
        if (actor.id() != null && actor.id().equals(behavior.getCreatedBy())) return true;
        return switch (String.valueOf(behavior.getScope())) {
            case SCOPE_DOMAIN, SCOPE_GLOBAL -> true;
            case SCOPE_COURSE -> teachesCourse(actor, behavior.getCourseId());
            case SCOPE_STUDENT -> teachesStudentScope(actor, behavior.getCourseId(), behavior.getClassId());
            default -> false;
        };
    }

    boolean canEdit(TeachingBehavior behavior, BehaviorActor actor) {
        if (SCOPE_GLOBAL.equals(behavior.getScope()) && !actor.isAdmin()) return false;
        if (actor.isAdmin()) return true;
        if (actor.id() != null && actor.id().equals(behavior.getCreatedBy())) return true;
        // The student's current teacher manages that student's own RAG set.
        return SCOPE_STUDENT.equals(behavior.getScope())
                && teachesStudentScope(actor, behavior.getCourseId(), behavior.getClassId());
    }

    public void requireTeacher(BehaviorActor actor) {
        if (actor.isAdmin()) return;
        if (!accessGuard.isTeacher(actor.role())) {
            throw new BehaviorAccessDeniedException("Chỉ giảng viên mới được quản lý hành vi giảng dạy");
        }
    }

    public void requireCourseTeacher(BehaviorActor actor, String courseId, String classId) {
        if (actor.isAdmin()) return;
        requireTeacher(actor);
        if (!teachesStudentScope(actor, courseId, classId)) {
            throw new BehaviorAccessDeniedException("Bạn không phụ trách môn này");
        }
    }

    public List<String> taughtCourseIds(BehaviorActor actor) {
        if (actor.isAdmin()) return List.of();
        Set<String> courses = new LinkedHashSet<>();
        for (ClassSection section : accessGuard.teacherSections(actor.id())) {
            if (section.getCourseId() != null) courses.add(section.getCourseId());
        }
        return new ArrayList<>(courses);
    }

    private void requireEditPermission(TeachingBehavior behavior, BehaviorActor actor) {
        if (!canEdit(behavior, actor)) {
            throw new BehaviorAccessDeniedException("Chỉ người tạo hành vi hoặc quản trị viên mới được sửa");
        }
    }

    private void requireCreatePermission(String scope, String studentId, String courseId, String classId,
                                         BehaviorActor actor) {
        if (actor.isAdmin()) return;
        if (!accessGuard.isTeacher(actor.role())) {
            throw new BehaviorAccessDeniedException("Chỉ giảng viên mới được thêm hành vi giảng dạy");
        }
        try {
            switch (scope) {
                case SCOPE_STUDENT -> {
                    if (classId == null) {
                        accessGuard.allowTeacherForCourseOrAdmin(actor.id(), actor.role(), courseId);
                    } else {
                        accessGuard.allowTeacherForStudentTranscript(
                                actor.id(), actor.role(), studentId, courseId, classId);
                    }
                }
                case SCOPE_COURSE -> accessGuard.allowTeacherForCourseOrAdmin(actor.id(), actor.role(), courseId);
                case SCOPE_GLOBAL -> throw new BehaviorAccessDeniedException(
                        "Hành vi toàn hệ thống chỉ quản trị viên được quản lý");
                default -> { }
            }
        } catch (IllegalArgumentException denied) {
            throw new BehaviorAccessDeniedException(denied.getMessage());
        }
    }

    private boolean teachesCourse(BehaviorActor actor, String courseId) {
        try {
            accessGuard.allowTeacherForCourseOrAdmin(actor.id(), actor.role(), courseId);
            return true;
        } catch (IllegalArgumentException denied) {
            return false;
        }
    }

    private boolean teachesStudentScope(BehaviorActor actor, String courseId, String classId) {
        if (classId == null) return teachesCourse(actor, courseId);
        try {
            accessGuard.allowTeacherForClassOrAdmin(actor.id(), actor.role(), courseId, classId);
            return true;
        } catch (IllegalArgumentException denied) {
            return false;
        }
    }

    private Criteria visibilityCriteria(BehaviorActor actor) {
        List<Criteria> visible = new ArrayList<>();
        visible.add(Criteria.where("scope").in(SCOPE_DOMAIN, SCOPE_GLOBAL));
        if (actor.id() != null) visible.add(Criteria.where("createdBy").is(actor.id()));
        List<ClassSection> sections = accessGuard.teacherSections(actor.id());
        Set<String> courses = new LinkedHashSet<>();
        for (ClassSection section : sections) {
            if (section.getCourseId() == null) continue;
            courses.add(section.getCourseId());
            if (section.getClassId() != null) {
                visible.add(Criteria.where("scope").is(SCOPE_STUDENT)
                        .and("courseId").is(section.getCourseId())
                        .and("classId").is(section.getClassId()));
            }
        }
        if (!courses.isEmpty()) {
            visible.add(Criteria.where("scope").is(SCOPE_COURSE).and("courseId").in(courses));
            visible.add(Criteria.where("scope").is(SCOPE_STUDENT).and("courseId").in(courses).and("classId").is(null));
        }
        return new Criteria().orOperator(visible.toArray(new Criteria[0]));
    }

    // -------------------------------------------------------------- helpers

    private TeachingBehavior saveReviewBehavior(AdaptiveLearningReview review, String text,
                                                BehaviorActor actor, LocalDateTime now) {
        TeachingBehavior behavior = TeachingBehavior.builder()
                .id(UUID.randomUUID().toString())
                .scope(SCOPE_STUDENT)
                .studentId(review.getStudentId())
                .courseId(review.getCourseId())
                .classId(trimToNull(review.getClassId()))
                .supportLevels(review.getSuggestedSupportLevel() == null
                        ? List.of() : normalizeLevels(List.of(review.getSuggestedSupportLevel())))
                .strategy(ExplanationStyles.strategyOf(text))
                .instruction(text)
                .targetSignals(reviewSignals(review))
                .version(1)
                .approvalStatus(APPROVAL_APPROVED)
                .status(STATUS_APPROVED)
                .sourceReviewId(review.getId())
                .createdBy(actor.id())
                .createdByName(trimToNull(actor.name()))
                .createdAt(now)
                .updatedAt(now)
                .build();
        behavior.setEmbedding(embed(embeddingText(behavior)));
        return repository.save(behavior);
    }

    /**
     * Saves a new approved behavior, or reinforces an existing near-identical
     * one in the same scope instead of creating a duplicate.
     */
    private TeachingBehavior saveDeduplicated(TeachingBehavior draft) {
        LocalDateTime now = LocalDateTime.now();
        List<Float> embedding = embed(embeddingText(draft));
        String text = embeddingText(draft);
        for (TeachingBehavior existing : sameScopeCandidates(draft)) {
            double similarity = similarity(embedding, text, existing.getEmbedding(), embeddingText(existing));
            if (similarity >= DUPLICATE_SIMILARITY
                    || normalizedKey(existing.getInstruction()).equals(normalizedKey(draft.getInstruction()))) {
                existing.setUseCount(existing.getUseCount() + 1);
                existing.setTargetSignals(mergeNewestFirst(draft.getTargetSignals(), existing.getTargetSignals(), 10, 120));
                existing.setSupportLevels(mergeLevels(existing.getSupportLevels(), draft.getSupportLevels()));
                existing.setUpdatedAt(now);
                return repository.save(existing);
            }
        }
        draft.setId(UUID.randomUUID().toString());
        draft.setEmbedding(embedding);
        draft.setCreatedAt(now);
        draft.setUpdatedAt(now);
        return repository.save(draft);
    }

    private List<TeachingBehavior> sameScopeCandidates(TeachingBehavior draft) {
        return switch (draft.getScope()) {
            case SCOPE_STUDENT -> repository.findByScopeAndStudentIdAndCourseIdAndStatusIn(
                    SCOPE_STUDENT, draft.getStudentId(), draft.getCourseId(), List.of(STATUS_APPROVED));
            case SCOPE_COURSE -> repository.findTop500ByScopeAndCourseIdAndStatus(
                    SCOPE_COURSE, draft.getCourseId(), STATUS_APPROVED);
            case SCOPE_DOMAIN -> repository.findTop500ByScopeAndDomainAndStatus(
                    SCOPE_DOMAIN, draft.getDomain(), STATUS_APPROVED);
            default -> repository.findTop500ByScopeAndStatus(SCOPE_GLOBAL, STATUS_APPROVED);
        };
    }

    /** An empty list means "applies to every support level". */
    private static List<String> mergeLevels(List<String> left, List<String> right) {
        if (safe(left).isEmpty() || safe(right).isEmpty()) return new ArrayList<>();
        Set<String> merged = new TreeSet<>(left);
        merged.addAll(right);
        return new ArrayList<>(merged);
    }

    private static List<String> reviewSignals(AdaptiveLearningReview review) {
        return mergeNewestFirst(review.getStruggleSignals(), review.getKnowledgeGaps(), 8, 120);
    }

    private String cleanInstruction(String raw, String scope, List<String> namesToStrip) {
        String text = requireField(raw, "instruction").replaceAll("\\s+", " ");
        if (text.length() > MAX_INSTRUCTION_LENGTH) {
            throw new IllegalArgumentException("Hành vi tối đa " + MAX_INSTRUCTION_LENGTH + " ký tự");
        }
        return SCOPE_STUDENT.equals(scope) ? text : stripSharedText(text, namesToStrip);
    }

    /** Shared behaviors must never carry the identity of the student they came from. */
    private String stripSharedText(String text, List<String> namesToStrip) {
        String sanitized = privacySanitizer.sanitize(text);
        for (String name : safe(namesToStrip)) {
            if (trimToNull(name) == null || name.trim().length() < 2) continue;
            sanitized = sanitized.replaceAll("(?i)" + Pattern.quote(name.trim()), "sinh viên");
        }
        return sanitized;
    }

    /** Stores the current template so a later edit does not rewrite past executions. */
    void snapshot(TeachingBehavior behavior, String editorId) {
        if (behavior == null || behavior.getId() == null || versionRepository == null) return;
        versionRepository.save(TeachingBehaviorVersion.builder()
                .behaviorId(behavior.getId())
                .version(Math.max(1, behavior.getVersion()))
                .name(behavior.getName())
                .description(behavior.getDescription())
                .strategy(behavior.getStrategy())
                .instruction(behavior.getInstruction())
                .supportLevels(new ArrayList<>(safe(behavior.getSupportLevels())))
                .applicableTopics(new ArrayList<>(safe(behavior.getApplicableTopics())))
                .priority(behavior.getPriority())
                .status(behavior.getStatus())
                .editedBy(editorId)
                .editedAt(LocalDateTime.now())
                .build());
    }

    public TeachingBehaviorVersionRepository versions() {
        return versionRepository;
    }

    private static String cleanOptional(String value, int max) {
        String text = trimToNull(value);
        if (text == null) return null;
        return text.length() <= max ? text : text.substring(0, max);
    }

    private static String cleanStrategy(String requested, String instruction) {
        String text = trimToNull(requested);
        if (text != null) {
            for (String strategy : ExplanationStyles.STRATEGIES) {
                if (strategy.equalsIgnoreCase(text)) return strategy;
            }
            throw new IllegalArgumentException("Phong cách không hợp lệ");
        }
        return ExplanationStyles.strategyOf(instruction);
    }

    static String embeddingText(TeachingBehavior behavior) {
        String signals = String.join("; ", safe(behavior.getTargetSignals()));
        return signals.isBlank() ? String.valueOf(behavior.getInstruction())
                : behavior.getInstruction() + "\n" + signals;
    }

    List<Float> embed(String text) {
        if (trimToNull(text) == null) return null;
        try {
            return embeddingService.generatePassageEmbedding(text).vectorAsList();
        } catch (Exception error) {
            log.warn("Teaching behavior embedding unavailable; lexical matching will be used: {}", error.getMessage());
            return null;
        }
    }

    private static List<String> normalizeLevels(List<String> levels) {
        List<String> result = new ArrayList<>();
        for (String level : safe(levels)) {
            String value = upper(level);
            if (value == null) continue;
            if (!SUPPORT_LEVELS.contains(value)) throw new IllegalArgumentException("Mức hỗ trợ không hợp lệ: " + level);
            if (!result.contains(value)) result.add(value);
        }
        return result.size() == SUPPORT_LEVELS.size() ? new ArrayList<>() : result;
    }

    private TeachingBehavior require(String id) {
        return repository.findById(requireField(id, "id"))
                .orElseThrow(() -> new NoSuchElementException("Không tìm thấy hành vi giảng dạy"));
    }

    private static String requireScope(String scope) {
        if (scope == null || !SCOPES.contains(scope)) throw new IllegalArgumentException("Phạm vi không hợp lệ");
        return scope;
    }

    public static String requireDomain(String domain) {
        String value = upper(domain);
        if (value == null || !LlmIntentClassifierService.DOMAINS.contains(value)) {
            throw new IllegalArgumentException("Domain không hợp lệ");
        }
        return value;
    }

    private static String requireField(String value, String field) {
        String text = trimToNull(value);
        if (text == null) throw new IllegalArgumentException(field + " là bắt buộc");
        return text;
    }

    private static String upper(String value) {
        String text = trimToNull(value);
        return text == null ? null : text.toUpperCase(Locale.ROOT);
    }
}
