package com.ragapi.service;

import com.ragapi.dto.CourseRagAnswer;
import com.ragapi.dto.cotraining.*;
import com.ragapi.entity.*;
import com.ragapi.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;
import java.util.regex.Pattern;

import static com.ragapi.util.ValidationUtils.*;

@Service
@RequiredArgsConstructor
public class ExpertCoTrainingService {
    private static final Set<String> TASK_TYPES = Set.of("GOLD_QA", "RUBRIC", "RANKING", "REVIEW");
    private static final Set<String> TASK_STATUSES = Set.of(
            "OPEN", "ASSIGNED", "IN_PROGRESS", "SUBMITTED", "COMPLETED", "CANCELLED");
    private static final Set<String> GOLD_USAGE = Set.of("TRAINING", "EVALUATION");
    private static final Set<String> DIFFICULTIES = Set.of("EASY", "MEDIUM", "HARD");
    private static final Set<String> SENIOR_ROLES = Set.of("SENIOR_MENTOR", "ADMIN");

    private final ExpertTaskRepository taskRepository;
    private final GoldQaRepository goldQaRepository;
    private final ExpertRubricRepository rubricRepository;
    private final CoverageGapRepository gapRepository;
    private final EvalRunRepository evalRunRepository;
    private final EvalResultRepository evalResultRepository;
    private final CourseMaterialRepository materialRepository;
    private final ChapterOutlineService chapterOutlineService;
    private final ElasticVectorService vectorService;
    private final CourseRagService courseRagService;
    private final CanonicalTutorAnswerCacheService answerCacheService;
    private final RealtimeEventService realtimeEvents;
    private final MongoTemplate mongoTemplate;

    public List<CoverageGap> analyzeCoverage(CoverageAnalysisRequest request) {
        if (request == null) {
            throw new IllegalArgumentException("request is required");
        }
        String courseId = requireText(request.getCourseId(), "courseId");
        boolean useSuggested = request.getUseSuggestedOrConfirmedChapters() == null
                || request.getUseSuggestedOrConfirmedChapters();
        boolean smartPolicy = request.getSmartTaskPolicy() == null || request.getSmartTaskPolicy();
        boolean includeTraining = Boolean.TRUE.equals(request.getIncludeTrainingGoldTasks());
        boolean includeBenchmark = Boolean.TRUE.equals(request.getIncludeBenchmarkTasks());

        List<String> explicit = request.getChapters() == null ? List.of() : request.getChapters().stream()
                .filter(Objects::nonNull).map(String::trim).filter(v -> !v.isBlank()).distinct().toList();
        List<String> chapters = explicit;
        if (chapters.isEmpty() && useSuggested) {
            chapters = chapterOutlineService.resolveChapterTitlesForAnalysis(courseId, List.of());
        }
        if (chapters.isEmpty()) {
            throw new IllegalArgumentException(
                    "No chapters to analyze. Upload and index course materials, confirm suggested chapters, or send chapters explicitly.");
        }

        int minTraining = positiveOrDefault(request.getMinimumTrainingGoldPerChapter(), smartPolicy ? 0 : 2);
        int minEvaluation = positiveOrDefault(request.getMinimumEvaluationGoldPerChapter(), smartPolicy ? 0 : 2);
        int materialCount = (int) materialRepository.findByCourseId(courseId).stream()
                .filter(m -> "INDEXED".equalsIgnoreCase(m.getIndexingStatus())).count();
        List<CoverageGap> detected = new ArrayList<>();

        for (String chapter : chapters) {
            CourseChapterOutline outline = chapterOutlineService.findOutlineByTitle(courseId, chapter);
            String materialHealth = chapterOutlineService.materialHealth(outline, materialCount);
            int training = goldQaRepository.findByCourseIdAndChapterAndUsage(courseId, chapter, "TRAINING").size();
            int evaluation = goldQaRepository.findByCourseIdAndChapterAndUsage(courseId, chapter, "EVALUATION").size();
            List<String> reasons = buildCoverageReasons(
                    materialCount, materialHealth, training, evaluation, minTraining, minEvaluation, smartPolicy);

            boolean trainingGap = training < minTraining;
            boolean evaluationGap = evaluation < minEvaluation;
            boolean materialBlocked = "NO_MATERIAL".equals(materialHealth) || "MATERIAL_THIN".equals(materialHealth);
            boolean goldActionNeeded = !materialBlocked && (
                    (!smartPolicy && (trainingGap || evaluationGap))
                            || (smartPolicy && includeTraining && trainingGap)
                            || (smartPolicy && includeBenchmark && evaluationGap));

            if (!materialBlocked && !goldActionNeeded) {
                gapRepository.findFirstByCourseIdAndChapterAndStatusInOrderByDetectedAtDesc(
                                courseId, chapter, List.of("OPEN", "TASK_CREATED"))
                        .ifPresent(existing -> {
                            existing.setStatus("RESOLVED");
                            existing.setResolvedBy(request.getRequestedBy());
                            existing.setResolvedAt(LocalDateTime.now());
                            existing.setUpdatedAt(LocalDateTime.now());
                            gapRepository.save(existing);
                        });
                continue;
            }

            CoverageGap gap = gapRepository.findFirstByCourseIdAndChapterAndStatusInOrderByDetectedAtDesc(
                            courseId, chapter, List.of("OPEN", "TASK_CREATED"))
                    .orElseGet(CoverageGap::new);
            boolean tasksAlreadyCreated = "TASK_CREATED".equals(gap.getStatus());
            LocalDateTime now = LocalDateTime.now();
            if (gap.getId() == null) {
                gap.setDetectedAt(now);
            }
            gap.setCourseId(courseId);
            gap.setChapter(chapter);
            gap.setMaterialCount(materialCount);
            gap.setTrainingGoldCount(training);
            gap.setEvaluationGoldCount(evaluation);
            gap.setMaterialHealth(materialHealth);
            gap.setChunkCount(outline == null || outline.getChunkCount() == null ? 0 : outline.getChunkCount());
            gap.setApproxChars(outline == null || outline.getApproxChars() == null ? 0L : outline.getApproxChars());
            gap.setReasons(reasons);
            gap.setSeverity(severity(materialHealth, materialCount, training, evaluation));
            gap.setStatus("OPEN");
            gap.setUpdatedAt(now);
            gap = gapRepository.save(gap);

            if (Boolean.TRUE.equals(request.getCreateTasks()) && !tasksAlreadyCreated && goldActionNeeded) {
                createGapTasks(gap, request.getRequestedBy(), trainingGap, evaluationGap,
                        materialHealth, smartPolicy, includeTraining, includeBenchmark, request.getTaskDueAt());
                gap.setStatus("TASK_CREATED");
                gap.setUpdatedAt(LocalDateTime.now());
                gap = gapRepository.save(gap);
            } else if (tasksAlreadyCreated) {
                gap.setStatus("TASK_CREATED");
                gap = gapRepository.save(gap);
            }
            detected.add(gap);
        }
        return detected;
    }

    private List<String> buildCoverageReasons(
            int materialCount,
            String materialHealth,
            int training,
            int evaluation,
            int minTraining,
            int minEvaluation,
            boolean smartPolicy
    ) {
        List<String> reasons = new ArrayList<>();
        if (materialCount == 0) {
            reasons.add("NO_MATERIAL: Course has no indexed material");
        }
        if ("NO_MATERIAL".equals(materialHealth)) {
            reasons.add("NO_MATERIAL: No indexed content mapped to this chapter");
        } else if ("MATERIAL_THIN".equals(materialHealth)) {
            reasons.add("MATERIAL_THIN: Indexed content for this chapter is too thin — upload or expand material first");
        } else if ("MATERIAL_OK".equals(materialHealth)) {
            reasons.add("MATERIAL_OK: RAG has sufficient material for this chapter");
        }
        if (smartPolicy && "MATERIAL_OK".equals(materialHealth)) {
            if (training < minTraining) {
                reasons.add("Optional: training Gold Q&A below " + minTraining);
            }
            if (evaluation < minEvaluation) {
                reasons.add("Optional: evaluation holdout below " + minEvaluation);
            }
        } else {
            if (training < minTraining) {
                reasons.add("Training GoldQA coverage is below " + minTraining);
            }
            if (evaluation < minEvaluation) {
                reasons.add("Evaluation holdout coverage is below " + minEvaluation);
            }
        }
        return reasons;
    }

    public ExpertTask createTask(CreateExpertTaskRequest request) {
        if (request == null) throw new IllegalArgumentException("request is required");
        String type = enumValue(request.getType(), "type", TASK_TYPES);
        LocalDateTime now = LocalDateTime.now();
        LocalDateTime dueAt = normalizeDueAt(request.getDueAt());
        ExpertTask saved = taskRepository.save(ExpertTask.builder()
                .courseId(requireText(request.getCourseId(), "courseId"))
                .chapter(requireMaxLength(request.getChapter(), "chapter", SHORT_TEXT_MAX_LENGTH))
                .type(type).status("OPEN")
                .priority(clampPriority(request.getPriority()))
                .sourceGapId(optionalMaxLength(request.getSourceGapId(), "sourceGapId", SHORT_TEXT_MAX_LENGTH))
                .title(requireMaxLength(request.getTitle(), "title", SHORT_TEXT_MAX_LENGTH))
                .instructions(optionalMaxLength(request.getInstructions(), "instructions", DEFAULT_TEXT_MAX_LENGTH))
                .createdBy(optionalMaxLength(request.getCreatedBy(), "createdBy", SHORT_TEXT_MAX_LENGTH))
                .dueAt(dueAt).createdAt(now).updatedAt(now).build());
        realtimeEvents.publishToRoles(Set.of("TEACHER", "SENIOR_MENTOR", "ADMIN"),
                "EXPERT_TASK_CREATED", "EXPERT_TASK", saved.getId(), saved.getStatus(),
                Map.of("courseId", saved.getCourseId(), "chapter", saved.getChapter(), "type", saved.getType()));
        return saved;
    }

    public List<ExpertTask> startChapter(CreateChapterTasksRequest request) {
        if (request == null) {
            throw new IllegalArgumentException("request is required");
        }
        String courseId = requireText(request.getCourseId(), "courseId");
        String chapter = requireText(request.getChapter(), "chapter");
        CourseChapterOutline outline = chapterOutlineService.findOutlineByTitle(courseId, chapter);
        if (outline == null) {
            throw new IllegalArgumentException("Chapter does not exist in indexed course materials");
        }
        if (outline.getChunkCount() == null || outline.getChunkCount() <= 0) {
            throw new IllegalArgumentException("Chapter has no indexed content");
        }
        chapter = outline.getTitle();
        List<ExpertTask> active = taskRepository.findByCourseIdAndChapterOrderByCreatedAtDesc(courseId, chapter).stream()
                .filter(task -> "GOLD_QA".equals(task.getType()))
                .filter(task -> Set.of("OPEN", "ASSIGNED", "IN_PROGRESS", "SUBMITTED").contains(task.getStatus()))
                .toList();
        if (!active.isEmpty()) {
            return active;
        }
        int count = request.getQuestionCount() == null ? 2 : Math.max(1, Math.min(5, request.getQuestionCount()));
        LocalDateTime dueAt = normalizeDueAt(request.getDueAt());
        String createdBy = optionalMaxLength(request.getCreatedBy(), "createdBy", SHORT_TEXT_MAX_LENGTH);
        List<ExpertTask> created = new ArrayList<>();
        for (int index = 1; index <= count; index++) {
            CreateExpertTaskRequest task = new CreateExpertTaskRequest();
            task.setCourseId(courseId);
            task.setChapter(chapter);
            task.setType("GOLD_QA");
            task.setPriority(80);
            task.setTitle("Q&A vàng " + index + "/" + count + " — " + chapter);
            task.setInstructions("Giáo trình là chuẩn duy nhất. "
                    + "Soạn câu hỏi + tóm tắt ý từ sách, rồi Lưu/đánh giá lại để xem trước câu AI sẽ trả cho SV (sách + tóm tắt, chưa nạp RAG). "
                    + "Khi câu đủ ý mới Gửi Senior — Senior chỉ duyệt nạp TRAINING, không phải bước làm AI tốt hơn.");
            task.setCreatedBy(createdBy);
            task.setDueAt(dueAt);
            created.add(createTask(task));
        }
        return created;
    }

    public List<ExpertTask> createChapterTasks(CreateChapterTasksRequest request) {
        return startChapter(request);
    }

    public List<ExpertTask> listTasks(String status, String courseId, String assigneeId) {
        if (assigneeId != null && !assigneeId.isBlank()) return taskRepository.findByAssigneeIdOrderByCreatedAtDesc(assigneeId.trim());
        if (courseId != null && !courseId.isBlank()) return taskRepository.findByCourseIdOrderByCreatedAtDesc(courseId.trim()).stream()
                .filter(t -> status == null || status.isBlank() || status.equalsIgnoreCase(t.getStatus())).toList();
        if (status != null && !status.isBlank()) return taskRepository.findByStatusOrderByPriorityDescCreatedAtAsc(status.trim().toUpperCase(Locale.ROOT));
        return taskRepository.findAll();
    }

    public Map<String, Object> searchTasks(
            String status,
            String courseId,
            String assigneeId,
            String type,
            String keyword,
            int page,
            int size,
            String sortBy,
            String sortDirection
    ) {
        int safePage = Math.max(0, page);
        int safeSize = Math.max(1, Math.min(100, size));
        Query mongoQuery = new Query();
        if (courseId != null && !courseId.isBlank()) {
            mongoQuery.addCriteria(Criteria.where("courseId").is(courseId.trim()));
        }
        if (status != null && !status.isBlank()) {
            mongoQuery.addCriteria(Criteria.where("status").is(enumValue(status, "status", TASK_STATUSES)));
        }
        if (type != null && !type.isBlank()) {
            mongoQuery.addCriteria(Criteria.where("type").is(enumValue(type, "type", TASK_TYPES)));
        }
        if (assigneeId != null && !assigneeId.isBlank()) {
            mongoQuery.addCriteria(Criteria.where("assigneeId").is(assigneeId.trim()));
        }
        if (keyword != null && !keyword.isBlank()) {
            Pattern searchPattern = Pattern.compile(Pattern.quote(keyword.trim()), Pattern.CASE_INSENSITIVE | Pattern.UNICODE_CASE);
            mongoQuery.addCriteria(new Criteria().orOperator(
                    Criteria.where("title").regex(searchPattern),
                    Criteria.where("chapter").regex(searchPattern),
                    Criteria.where("instructions").regex(searchPattern),
                    Criteria.where("assigneeId").regex(searchPattern),
                    Criteria.where("createdBy").regex(searchPattern)
            ));
        }

        long totalElements = mongoTemplate.count(mongoQuery, ExpertTask.class);
        String requestedSortBy = defaultText(sortBy, "updatedAt");
        String safeSortBy = switch (requestedSortBy) {
            case "createdAt", "dueAt", "priority", "status", "title" -> requestedSortBy;
            default -> "updatedAt";
        };
        Sort.Direction direction = "asc".equalsIgnoreCase(sortDirection)
                ? Sort.Direction.ASC
                : Sort.Direction.DESC;
        mongoQuery.with(Sort.by(direction, safeSortBy).and(Sort.by(Sort.Direction.DESC, "createdAt")));
        mongoQuery.skip((long) safePage * safeSize).limit(safeSize);
        List<ExpertTask> tasks = mongoTemplate.find(mongoQuery, ExpertTask.class);
        int totalPages = totalElements == 0 ? 0 : (int) Math.ceil(totalElements / (double) safeSize);

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("tasks", tasks);
        response.put("page", safePage);
        response.put("size", safeSize);
        response.put("totalElements", totalElements);
        response.put("totalPages", totalPages);
        response.put("hasNext", safePage + 1 < totalPages);
        return response;
    }

    public ExpertTask getTask(String id) {
        return task(id);
    }

    public ExpertTask updateTask(String id, UpdateExpertTaskRequest request) {
        if (request == null) throw new IllegalArgumentException("request is required");
        ExpertTask task = task(id);
        if (request.getTitle() != null) {
            task.setTitle(requireMaxLength(request.getTitle(), "title", SHORT_TEXT_MAX_LENGTH));
        }
        if (request.getInstructions() != null) {
            task.setInstructions(optionalMaxLength(request.getInstructions(), "instructions", DEFAULT_TEXT_MAX_LENGTH));
        }
        if (request.getPriority() != null) {
            task.setPriority(clampPriority(request.getPriority()));
        }
        task.setDueAt(request.getDueAt() == null ? null : normalizeDueAt(request.getDueAt()));

        String nextStatus = request.getStatus() == null || request.getStatus().isBlank()
                ? task.getStatus()
                : enumValue(request.getStatus(), "status", TASK_STATUSES);
        boolean statusChanged = !Objects.equals(nextStatus, task.getStatus());
        boolean hasContribution = !goldQaRepository.findBySourceTaskId(task.getId()).isEmpty()
                || !rubricRepository.findBySourceTaskId(task.getId()).isEmpty();
        if (hasContribution && statusChanged) {
            throw new IllegalArgumentException("Task already has a contribution; its status is controlled by the review flow");
        }

        if (request.getAssigneeId() != null) {
            String assigneeId = request.getAssigneeId().trim();
            task.setAssigneeId(assigneeId.isBlank() ? null : assigneeId);
            task.setAssigneeTier(task.getAssigneeId() == null
                    ? null
                    : optionalMaxLength(request.getAssigneeTier(), "assigneeTier", SHORT_TEXT_MAX_LENGTH));
        }
        if ("OPEN".equals(nextStatus)) {
            task.setAssigneeId(null);
            task.setAssigneeTier(null);
        } else if (Set.of("ASSIGNED", "IN_PROGRESS").contains(nextStatus)
                && (task.getAssigneeId() == null || task.getAssigneeId().isBlank())) {
            throw new IllegalArgumentException("assigneeId is required for status " + nextStatus);
        }

        task.setStatus(nextStatus);
        task.setCompletedAt(Set.of("COMPLETED", "CANCELLED").contains(nextStatus)
                ? Optional.ofNullable(task.getCompletedAt()).orElse(LocalDateTime.now())
                : null);
        task.setUpdatedAt(LocalDateTime.now());
        ExpertTask saved = taskRepository.save(task);
        realtimeEvents.publishToRoles(Set.of("TEACHER", "SENIOR_MENTOR", "ADMIN"),
                "EXPERT_TASK_UPDATED", "EXPERT_TASK", saved.getId(), saved.getStatus(),
                Map.of("courseId", saved.getCourseId(), "chapter", saved.getChapter(), "type", saved.getType()));
        return saved;
    }

    public void deleteTask(String id) {
        ExpertTask task = task(id);
        if (!goldQaRepository.findBySourceTaskId(task.getId()).isEmpty()
                || !rubricRepository.findBySourceTaskId(task.getId()).isEmpty()) {
            throw new IllegalArgumentException(
                    "Task already has a contribution and cannot be deleted; cancel it or complete the review flow");
        }
        taskRepository.delete(task);
        if (task.getSourceGapId() != null && !task.getSourceGapId().isBlank()) {
            gapRepository.findById(task.getSourceGapId()).ifPresent(gap -> {
                gap.setStatus("OPEN");
                gap.setUpdatedAt(LocalDateTime.now());
                gapRepository.save(gap);
            });
        }
        realtimeEvents.publishToRoles(Set.of("TEACHER", "SENIOR_MENTOR", "ADMIN"),
                "EXPERT_TASK_DELETED", "EXPERT_TASK", task.getId(), "DELETED",
                Map.of("courseId", task.getCourseId(), "chapter", task.getChapter(), "type", task.getType()));
    }

    public ExpertTask assignTask(String id, AssignExpertTaskRequest request) {
        ExpertTask task = task(id);
        if (!Set.of("OPEN", "ASSIGNED").contains(task.getStatus())) throw new IllegalArgumentException("Task cannot be assigned in status " + task.getStatus());
        task.setAssigneeId(requireText(request == null ? null : request.getAssigneeId(), "assigneeId"));
        task.setAssigneeTier(optionalMaxLength(request.getAssigneeTier(), "assigneeTier", SHORT_TEXT_MAX_LENGTH));
        task.setStatus("ASSIGNED"); task.setUpdatedAt(LocalDateTime.now());
        ExpertTask saved = taskRepository.save(task);
        realtimeEvents.publishToUser(saved.getAssigneeId(), "EXPERT_TASK_ASSIGNED", "EXPERT_TASK",
                saved.getId(), saved.getStatus(), Map.of("courseId", saved.getCourseId(), "chapter", saved.getChapter()));
        return saved;
    }

    public GoldQa submitGoldQa(SubmitGoldQaRequest request) {
        if (request == null) throw new IllegalArgumentException("request is required");
        String usage = request.getUsage() == null || request.getUsage().isBlank()
                ? "TRAINING"
                : enumValue(request.getUsage(), "usage", GOLD_USAGE);
        String difficulty = enumValue(request.getDifficulty(), "difficulty", DIFFICULTIES);
        ExpertTask task = optionalTask(request.getSourceTaskId(), "GOLD_QA");
        LocalDateTime now = LocalDateTime.now();
        String authorId = requireText(request.getAuthorId(), "authorId");
        GoldQa gold = resolveEditableGoldQa(request.getGoldQaId(), task, authorId)
                .orElseGet(() -> GoldQa.builder()
                        .courseId(requireText(request.getCourseId(), "courseId"))
                        .usage(usage)
                        .holdout(false)
                        .version(1)
                        .authorId(authorId)
                        .sourceTaskId(request.getSourceTaskId())
                        .createdAt(now)
                        .build());
        String previousStatus = gold.getStatus();
        boolean preserveExam = "BASELINE_EXAMINED".equals(previousStatus) || "EXAMINED".equals(previousStatus);
        gold.setCourseId(requireText(request.getCourseId(), "courseId"));
        gold.setChapter(requireMaxLength(request.getChapter(), "chapter", SHORT_TEXT_MAX_LENGTH));
        gold.setQuestion(requireMaxLength(request.getQuestion(), "question", DEFAULT_TEXT_MAX_LENGTH));
        gold.setGoldAnswer(requireMaxLength(request.getGoldAnswer(), "goldAnswer", DEFAULT_TEXT_MAX_LENGTH));
        gold.setDifficulty(difficulty);
        gold.setUsage(usage);
        gold.setHoldout(false);
        gold.setRubricId(request.getRubricId());
        if (preserveExam) {
            // Keep exam attempts; only Senior reject resets the 2-exam quota.
            gold.setStatus(previousStatus);
        } else {
            gold.setStatus("DRAFT");
            gold.setRejectionReason(null);
            gold.setReviewNote(null);
            gold.setReviewedBy(null);
            gold.setReviewedAt(null);
            clearExamResults(gold);
        }
        gold.setUpdatedAt(now);
        GoldQa saved = goldQaRepository.save(gold);
        attachContributionDraft(task, saved.getId());
        return saved;
    }

    public GoldQa examGoldQa(String id) {
        GoldQa gold = goldQaRepository.findById(requireText(id, "id"))
                .orElseThrow(() -> new IllegalArgumentException("GoldQA not found"));
        ensureTeacherExamable(gold.getStatus());
        if ("EXAMINED".equals(gold.getStatus()) || Boolean.TRUE.equals(gold.getExamUsedTeachingNote())) {
            throw new IllegalArgumentException(
                    "Đã dùng đủ 2 lượt đánh giá (lần 1 + đánh giá lại). Chỉ được đánh giá lại sau khi Senior từ chối và gửi về."
            );
        }
        if ("BASELINE_EXAMINED".equals(gold.getStatus())
                || (gold.getExamBaselineAiAnswer() != null && !gold.getExamBaselineAiAnswer().isBlank())) {
            examineWithTeachingNote(gold);
            GoldQa examined = goldQaRepository.findById(gold.getId()).orElse(gold);
            examined.setStatus("EXAMINED");
            examined.setExamUsedTeachingNote(true);
            examined.setUpdatedAt(LocalDateTime.now());
            GoldQa saved = goldQaRepository.save(examined);
            realtimeEvents.publishToUser(saved.getAuthorId(), "GOLD_QA_EXAMINED", "GOLD_QA", saved.getId(),
                    saved.getStatus(), Map.of("courseId", saved.getCourseId(), "usage", saved.getUsage(),
                            "examPassed", Boolean.TRUE.equals(saved.getExamPassed()),
                            "examUsedTeachingNote", true));
            return saved;
        }
        examineBaseline(gold);
        GoldQa examined = goldQaRepository.findById(gold.getId()).orElse(gold);
        examined.setStatus("BASELINE_EXAMINED");
        examined.setExamUsedTeachingNote(false);
        examined.setUpdatedAt(LocalDateTime.now());
        GoldQa saved = goldQaRepository.save(examined);
        realtimeEvents.publishToUser(saved.getAuthorId(), "GOLD_QA_BASELINE_EXAMINED", "GOLD_QA", saved.getId(),
                saved.getStatus(), Map.of("courseId", saved.getCourseId(), "usage", saved.getUsage(),
                        "examPassed", Boolean.TRUE.equals(saved.getExamPassed()),
                        "examUsedTeachingNote", false));
        return saved;
    }

    public void deleteGoldQa(String id, String authorId) {
        GoldQa gold = goldQaRepository.findById(requireText(id, "id"))
                .orElseThrow(() -> new IllegalArgumentException("GoldQA not found"));
        String safeAuthor = requireText(authorId, "authorId");
        if (!safeAuthor.equals(gold.getAuthorId())) {
            throw new IllegalArgumentException("Only the author can delete this Gold Q&A");
        }
        if (!Set.of("DRAFT", "BASELINE_EXAMINED", "EXAMINED", "REJECTED").contains(gold.getStatus())) {
            throw new IllegalArgumentException("Gold Q&A cannot be deleted in status " + gold.getStatus());
        }
        String taskId = gold.getSourceTaskId();
        goldQaRepository.deleteById(gold.getId());
        if (taskId != null && !taskId.isBlank()) {
            taskRepository.findById(taskId).ifPresent(task -> refreshTaskStatusAfterGoldChange(task, null));
        }
    }

    public GoldQa submitGoldQaAndExam(SubmitGoldQaRequest request) {
        return examGoldQa(submitGoldQa(request).getId());
    }

    public GoldQa sendGoldQaForReview(String id) {
        GoldQa gold = goldQaRepository.findById(requireText(id, "id"))
                .orElseThrow(() -> new IllegalArgumentException("GoldQA not found"));
        if (!"EXAMINED".equals(gold.getStatus())) {
            throw new IllegalArgumentException("Chỉ gửi Senior sau khi Cho AI đánh giá lại (đã gắn ý chính giáo viên)");
        }
        if (!Boolean.TRUE.equals(gold.getExamUsedTeachingNote())) {
            throw new IllegalArgumentException("Chạy Cho AI đánh giá lại với ý chính giáo viên trước khi gửi Senior");
        }
        if (gold.getExaminedAt() == null && gold.getExamAiAnswer() == null) {
            throw new IllegalArgumentException("Run exam before sending Gold Q&A to Senior");
        }
        gold.setStatus("PENDING_REVIEW");
        gold.setUpdatedAt(LocalDateTime.now());
        GoldQa saved = goldQaRepository.save(gold);
        ExpertTask task = optionalTask(saved.getSourceTaskId(), "GOLD_QA");
        refreshTaskStatusAfterGoldChange(task, saved.getId());
        realtimeEvents.publishToRoles(SENIOR_ROLES, "GOLD_QA_SUBMITTED", "GOLD_QA", saved.getId(),
                saved.getStatus(), Map.of("courseId", saved.getCourseId(), "usage", saved.getUsage(),
                        "authorId", saved.getAuthorId(), "examPassed", Boolean.TRUE.equals(saved.getExamPassed())));
        return saved;
    }

    public ExpertRubric submitRubric(SubmitRubricRequest request) {
        if (request == null) throw new IllegalArgumentException("request is required");
        validateWeights(request.getCriteriaWeights());
        ExpertTask task = optionalTask(request.getSourceTaskId(), "RUBRIC");
        LocalDateTime now = LocalDateTime.now();
        ExpertRubric rubric = rubricRepository.save(ExpertRubric.builder()
                .courseId(requireText(request.getCourseId(), "courseId"))
                .chapter(requireMaxLength(request.getChapter(), "chapter", SHORT_TEXT_MAX_LENGTH))
                .name(requireMaxLength(request.getName(), "name", SHORT_TEXT_MAX_LENGTH))
                .description(optionalMaxLength(request.getDescription(), "description", DEFAULT_TEXT_MAX_LENGTH))
                .criteriaWeights(new LinkedHashMap<>(request.getCriteriaWeights()))
                .status("PENDING_REVIEW").version(1)
                .authorId(requireText(request.getAuthorId(), "authorId"))
                .sourceTaskId(request.getSourceTaskId()).createdAt(now).updatedAt(now).build());
        completeContributionTask(task, rubric.getId());
        realtimeEvents.publishToRoles(SENIOR_ROLES, "RUBRIC_SUBMITTED", "EXPERT_RUBRIC", rubric.getId(),
                rubric.getStatus(), Map.of("courseId", rubric.getCourseId(), "authorId", rubric.getAuthorId()));
        return rubric;
    }

    public GoldQa reviewGoldQa(String id, ExpertReviewRequest request, boolean approve) throws Exception {
        GoldQa gold = goldQaRepository.findById(requireText(id, "id")).orElseThrow(() -> new IllegalArgumentException("GoldQA not found"));
        ensurePending(gold.getStatus()); ensureSenior(request);
        LocalDateTime now = LocalDateTime.now();
        gold.setReviewedBy(request.getReviewerId()); gold.setReviewNote(request.getReviewNote()); gold.setReviewedAt(now); gold.setUpdatedAt(now);
        if (!approve) {
            gold.setRejectionReason(requireMaxLength(request.getRejectionReason(), "rejectionReason", DEFAULT_TEXT_MAX_LENGTH));
            // Reset 2 exam attempts so Teacher can Cho AI đánh giá + đánh giá lại again after revising.
            clearExamResults(gold);
            gold.setStatus("REJECTED");
        } else if ("EVALUATION".equalsIgnoreCase(gold.getUsage())) {
            // Holdout only: never index teacher text into RAG (textbook remains sole factual source).
            gold.setStatus("APPROVED");
            gold.setHoldout(true);
            gold.setIndexedAt(null);
        } else {
            // TRAINING: index as a book-aligned teaching note, not as an override of the textbook.
            writeTeachingNoteToElasticsearch(gold);
            gold.setStatus("INDEXED");
            gold.setIndexedAt(now);
            gold.setHoldout(false);
        }
        GoldQa saved = goldQaRepository.save(gold);
        if (approve && "INDEXED".equalsIgnoreCase(saved.getStatus())) {
            answerCacheService.evictRagAnswersForCourse(saved.getCourseId());
        }
        refreshTaskStatusAfterGoldChange(
                saved.getSourceTaskId() == null ? null : taskRepository.findById(saved.getSourceTaskId()).orElse(null),
                saved.getId()
        );
        realtimeEvents.publishToUser(saved.getAuthorId(), approve ? "GOLD_QA_APPROVED" : "GOLD_QA_REJECTED",
                "GOLD_QA", saved.getId(), saved.getStatus(), Map.of("courseId", saved.getCourseId(), "usage", saved.getUsage()));
        return saved;
    }

    public ExpertRubric reviewRubric(String id, ExpertReviewRequest request, boolean approve) {
        ExpertRubric rubric = rubricRepository.findById(requireText(id, "id")).orElseThrow(() -> new IllegalArgumentException("Rubric not found"));
        ensurePending(rubric.getStatus()); ensureSenior(request);
        rubric.setStatus(approve ? "APPROVED" : "REJECTED");
        rubric.setReviewedBy(request.getReviewerId()); rubric.setReviewNote(approve ? request.getReviewNote() : requireText(request.getRejectionReason(), "rejectionReason"));
        rubric.setReviewedAt(LocalDateTime.now()); rubric.setUpdatedAt(LocalDateTime.now());
        ExpertRubric saved = rubricRepository.save(rubric);
        completeReviewedTask(saved.getSourceTaskId(), approve);
        realtimeEvents.publishToUser(saved.getAuthorId(), approve ? "RUBRIC_APPROVED" : "RUBRIC_REJECTED",
                "EXPERT_RUBRIC", saved.getId(), saved.getStatus(), Map.of("courseId", saved.getCourseId()));
        return saved;
    }

    public List<GoldQa> listGoldQa(String courseId, String usage, String status) {
        return goldQaRepository.findByCourseIdOrderByCreatedAtDesc(requireText(courseId, "courseId")).stream()
                .filter(g -> usage == null || usage.isBlank() || usage.equalsIgnoreCase(g.getUsage()))
                .filter(g -> status == null || status.isBlank() || status.equalsIgnoreCase(g.getStatus())).toList();
    }

    public List<GoldQa> listIndexedTeachingNotes(String courseId, String status) {
        Set<String> statuses;
        if (status != null && !status.isBlank()) {
            statuses = Set.of(status.trim().toUpperCase(Locale.ROOT));
        } else {
            statuses = Set.of("INDEXED", "UNINDEXED");
        }
        if (courseId != null && !courseId.isBlank()) {
            return goldQaRepository.findByCourseIdAndStatusInOrderByUpdatedAtDesc(courseId.trim(), statuses);
        }
        return goldQaRepository.findByStatusInOrderByUpdatedAtDesc(statuses);
    }

    public GoldQa updateIndexedTeachingNote(String id, UpdateIndexedTeachingNoteRequest request) throws Exception {
        if (request == null) throw new IllegalArgumentException("request is required");
        GoldQa gold = requireManagedTeachingNote(id);
        if (request.getChapter() != null && !request.getChapter().isBlank()) {
            gold.setChapter(requireMaxLength(request.getChapter(), "chapter", SHORT_TEXT_MAX_LENGTH));
        }
        if (request.getQuestion() != null && !request.getQuestion().isBlank()) {
            gold.setQuestion(requireMaxLength(request.getQuestion(), "question", DEFAULT_TEXT_MAX_LENGTH));
        }
        if (request.getGoldAnswer() != null && !request.getGoldAnswer().isBlank()) {
            gold.setGoldAnswer(requireMaxLength(request.getGoldAnswer(), "goldAnswer", DEFAULT_TEXT_MAX_LENGTH));
        }
        gold.setUpdatedAt(LocalDateTime.now());
        boolean shouldReindex = !Boolean.FALSE.equals(request.getReindex())
                || "INDEXED".equalsIgnoreCase(gold.getStatus());
        if (shouldReindex) {
            rewriteTeachingNoteIndex(gold);
            gold.setStatus("INDEXED");
            gold.setIndexedAt(LocalDateTime.now());
        }
        GoldQa saved = goldQaRepository.save(gold);
        answerCacheService.evictRagAnswersForCourse(saved.getCourseId());
        return saved;
    }

    public GoldQa reindexTeachingNote(String id) throws Exception {
        GoldQa gold = requireManagedTeachingNote(id);
        rewriteTeachingNoteIndex(gold);
        gold.setStatus("INDEXED");
        gold.setIndexedAt(LocalDateTime.now());
        gold.setUpdatedAt(LocalDateTime.now());
        GoldQa saved = goldQaRepository.save(gold);
        answerCacheService.evictRagAnswersForCourse(saved.getCourseId());
        return saved;
    }

    public GoldQa unindexTeachingNote(String id) throws Exception {
        GoldQa gold = requireManagedTeachingNote(id);
        vectorService.deleteChunksByMaterialId(gold.getId());
        gold.setStatus("UNINDEXED");
        gold.setIndexedAt(null);
        gold.setUpdatedAt(LocalDateTime.now());
        GoldQa saved = goldQaRepository.save(gold);
        answerCacheService.evictRagAnswersForCourse(saved.getCourseId());
        return saved;
    }

    public void deleteIndexedTeachingNote(String id) throws Exception {
        GoldQa gold = requireManagedTeachingNote(id);
        String courseId = gold.getCourseId();
        String taskId = gold.getSourceTaskId();
        vectorService.deleteChunksByMaterialId(gold.getId());
        goldQaRepository.deleteById(gold.getId());
        if (courseId != null && !courseId.isBlank()) {
            answerCacheService.evictRagAnswersForCourse(courseId);
        }
        if (taskId != null && !taskId.isBlank()) {
            taskRepository.findById(taskId).ifPresent(task -> refreshTaskStatusAfterGoldChange(task, null));
        }
    }

    private GoldQa requireManagedTeachingNote(String id) {
        GoldQa gold = goldQaRepository.findById(requireText(id, "id"))
                .orElseThrow(() -> new IllegalArgumentException("GoldQA not found"));
        if (!Set.of("INDEXED", "UNINDEXED").contains(gold.getStatus())) {
            throw new IllegalArgumentException(
                    "Chỉ quản lý được ghi chú đã duyệt nạp RAG (INDEXED/UNINDEXED). Status hiện tại: " + gold.getStatus());
        }
        if ("EVALUATION".equalsIgnoreCase(gold.getUsage())) {
            throw new IllegalArgumentException("EVALUATION holdout không được index vào RAG");
        }
        return gold;
    }

    private void rewriteTeachingNoteIndex(GoldQa gold) throws Exception {
        vectorService.deleteChunksByMaterialId(gold.getId());
        writeTeachingNoteToElasticsearch(gold);
    }

    private void writeTeachingNoteToElasticsearch(GoldQa gold) throws Exception {
        vectorService.indexChunk(
                gold.getCourseId(),
                null,
                gold.getAuthorId(),
                gold.getId(),
                "COURSE_SHARED",
                "GOLD_QA",
                null,
                null,
                buildTeachingNoteContent(gold)
        );
    }

    private String buildTeachingNoteContent(GoldQa gold) {
        return ""
                + "Course-material teaching note (textbook/course materials are authoritative; this note must not contradict them).\n"
                + "Chapter: " + (gold.getChapter() == null ? "" : gold.getChapter()) + "\n"
                + "Student question: " + gold.getQuestion() + "\n"
                + "Key points summarized from course materials:\n"
                + gold.getGoldAnswer();
    }

    public List<ExpertRubric> listRubrics(String courseId) {
        return rubricRepository.findByCourseIdOrderByCreatedAtDesc(requireText(courseId, "courseId"));
    }

    public EvalRun runEvaluation(StartEvalRunRequest request) {
        String courseId = requireText(request == null ? null : request.getCourseId(), "courseId");
        double threshold = request.getPassThreshold() == null ? 0.6 : Math.max(0.0, Math.min(1.0, request.getPassThreshold()));
        List<GoldQa> cases = goldQaRepository.findByCourseIdAndUsageAndStatus(courseId, "EVALUATION", "APPROVED").stream()
                .filter(g -> request.getChapter() == null || request.getChapter().isBlank() || request.getChapter().equalsIgnoreCase(g.getChapter())).toList();
        if (cases.isEmpty()) throw new IllegalArgumentException("No approved evaluation holdout cases found");
        LocalDateTime now = LocalDateTime.now();
        Optional<EvalRun> baseline = evalRunRepository.findFirstByCourseIdAndStatusOrderByCompletedAtDesc(courseId, "PASSED");
        EvalRun run = evalRunRepository.save(EvalRun.builder().courseId(courseId).chapter(request.getChapter())
                .status("RUNNING").harnessVersion(defaultText(request.getHarnessVersion(), "v2-mvp-deterministic"))
                .kbVersion(defaultText(request.getKbVersion(), "current")).promptVersion(defaultText(request.getPromptVersion(), "current"))
                .totalCases(cases.size()).passThreshold(threshold).baselineRunId(baseline.map(EvalRun::getId).orElse(null))
                .triggeredBy(request.getTriggeredBy()).createdAt(now).startedAt(now).build());
        try {
            List<EvalResult> results = new ArrayList<>();
            for (GoldQa gold : cases) results.add(evaluate(run, gold, threshold));
            evalResultRepository.saveAll(results);
            double average = results.stream().mapToDouble(EvalResult::getScore).average().orElse(0.0);
            long hallucinated = results.stream().filter(r -> Boolean.TRUE.equals(r.getHallucinated())).count();
            int passed = (int) results.stream().filter(r -> Boolean.TRUE.equals(r.getPassed())).count();
            boolean regression = baseline.map(b -> b.getAverageScore() != null && average < b.getAverageScore() - 0.05).orElse(false);
            run.setPassedCases(passed); run.setAverageScore(round(average)); run.setHallucinationRate(round(hallucinated / (double) results.size()));
            run.setRegressionDetected(regression); run.setMetrics(Map.of("accuracy", round(passed / (double) results.size()), "averageScore", round(average)));
            run.setStatus(average >= threshold && !regression ? "PASSED" : "FAILED"); run.setCompletedAt(LocalDateTime.now());
            EvalRun saved = evalRunRepository.save(run);
            realtimeEvents.publishToRoles(SENIOR_ROLES, "EVAL_RUN_COMPLETED", "EVAL_RUN", saved.getId(),
                    saved.getStatus(), Map.of("courseId", saved.getCourseId(), "averageScore", saved.getAverageScore()));
            return saved;
        } catch (Exception e) {
            run.setStatus("ERROR"); run.setError(e.getMessage()); run.setCompletedAt(LocalDateTime.now());
            EvalRun saved = evalRunRepository.save(run);
            realtimeEvents.publishToRoles(SENIOR_ROLES, "EVAL_RUN_FAILED", "EVAL_RUN", saved.getId(),
                    saved.getStatus(), Map.of("courseId", saved.getCourseId()));
            return saved;
        }
    }

    public List<EvalRun> listEvalRuns(String courseId) { return evalRunRepository.findByCourseIdOrderByCreatedAtDesc(requireText(courseId, "courseId")); }
    public Map<String, Object> evalRunDetail(String id) {
        EvalRun run = evalRunRepository.findById(requireText(id, "id")).orElseThrow(() -> new IllegalArgumentException("EvalRun not found"));
        return Map.of("run", run, "results", evalResultRepository.findByEvalRunIdOrderByCreatedAtAsc(run.getId()));
    }
    public List<CoverageGap> listGaps(String courseId) { return gapRepository.findByCourseIdOrderByDetectedAtDesc(requireText(courseId, "courseId")); }

    private EvalResult evaluate(EvalRun run, GoldQa gold, double threshold) throws Exception {
        ExamSnapshot exam = scoreAgainstCurrentRag(gold, threshold);
        return EvalResult.builder().evalRunId(run.getId()).goldQaId(gold.getId()).courseId(gold.getCourseId()).chapter(gold.getChapter())
                .question(gold.getQuestion()).goldAnswer(gold.getGoldAnswer()).aiAnswer(exam.aiAnswer()).score(exam.score())
                .ragConfidence(exam.confidence()).passed(exam.passed()).hallucinated(exam.hallucinated())
                .criterionScores(Map.of("tokenOverlap", exam.overlap(), "ragConfidence", exam.confidence()))
                .createdAt(LocalDateTime.now()).build();
    }

    private void examineBaseline(GoldQa gold) {
        try {
            ExamSnapshot exam = scoreAgainstCurrentRag(gold, 0.6);
            gold.setExamBaselineAiAnswer(exam.aiAnswer());
            gold.setExamBaselineScore(exam.score());
            gold.setExamBaselineRagConfidence(exam.confidence());
            gold.setExamBaselinePassed(exam.passed());
            gold.setExamAiAnswer(exam.aiAnswer());
            gold.setExamScore(exam.score());
            gold.setExamRagConfidence(exam.confidence());
            gold.setExamPassed(exam.passed());
            gold.setExamHallucinated(exam.hallucinated());
            gold.setExamUsedTeachingNote(false);
            gold.setExamError(null);
            gold.setExaminedAt(LocalDateTime.now());
            gold.setUpdatedAt(LocalDateTime.now());
            goldQaRepository.save(gold);
        } catch (Exception error) {
            gold.setExamError(error.getMessage() == null ? "Exam failed" : error.getMessage());
            gold.setExamPassed(false);
            gold.setExamUsedTeachingNote(false);
            gold.setExaminedAt(LocalDateTime.now());
            gold.setUpdatedAt(LocalDateTime.now());
            goldQaRepository.save(gold);
        }
    }

    private void examineWithTeachingNote(GoldQa gold) {
        try {
            String baseline = gold.getExamBaselineAiAnswer();
            if (baseline == null || baseline.isBlank()) {
                baseline = gold.getExamAiAnswer();
            }
            ExamSnapshot exam = scoreSynthesizedExam(gold, baseline, 0.6);
            // Option: never show a worse retake score than the baseline coverage.
            double keptScore = exam.score();
            if (gold.getExamBaselineScore() != null) {
                keptScore = Math.max(keptScore, gold.getExamBaselineScore());
            }
            gold.setExamAiAnswer(exam.aiAnswer());
            gold.setExamScore(round(keptScore));
            gold.setExamRagConfidence(exam.confidence());
            gold.setExamPassed(keptScore >= 0.6 && !exam.hallucinated());
            gold.setExamHallucinated(exam.hallucinated());
            gold.setExamUsedTeachingNote(true);
            gold.setExamError(null);
            gold.setExaminedAt(LocalDateTime.now());
            gold.setUpdatedAt(LocalDateTime.now());
            goldQaRepository.save(gold);
        } catch (Exception error) {
            gold.setExamError(error.getMessage() == null ? "Exam failed" : error.getMessage());
            gold.setExamPassed(false);
            gold.setExamUsedTeachingNote(true);
            gold.setExaminedAt(LocalDateTime.now());
            gold.setUpdatedAt(LocalDateTime.now());
            goldQaRepository.save(gold);
        }
    }

    private ExamSnapshot scoreSynthesizedExam(GoldQa gold, String baselineAnswer, double threshold) throws Exception {
        CourseRagAnswer answer = courseRagService.askWithConfidenceSynthesizingExam(
                gold.getQuestion(),
                gold.getCourseId(),
                null,
                gold.getChapter(),
                gold.getGoldAnswer(),
                baselineAnswer
        );
        return scoreAnswer(gold, answer, threshold);
    }

    private void clearExamResults(GoldQa gold) {
        if (gold == null) return;
        gold.setExamAiAnswer(null);
        gold.setExamScore(null);
        gold.setExamRagConfidence(null);
        gold.setExamPassed(null);
        gold.setExamHallucinated(null);
        gold.setExamError(null);
        gold.setExamBaselineAiAnswer(null);
        gold.setExamBaselineScore(null);
        gold.setExamBaselineRagConfidence(null);
        gold.setExamBaselinePassed(null);
        gold.setExamUsedTeachingNote(null);
        gold.setExaminedAt(null);
    }

    private ExamSnapshot scoreAgainstCurrentRag(GoldQa gold, double threshold) throws Exception {
        CourseRagAnswer answer = courseRagService.askWithConfidence(
                gold.getQuestion(),
                gold.getCourseId(),
                null
        );
        return scoreAnswer(gold, answer, threshold);
    }

    private ExamSnapshot scoreAnswer(GoldQa gold, CourseRagAnswer answer, double threshold) {
        double overlap = tokenOverlap(gold.getGoldAnswer(), answer.getAnswer());
        double confidence = answer.getConfidence() == null ? 0.0 : answer.getConfidence();
        double score = round(overlap * 0.75 + confidence * 0.25);
        boolean hallucinated = Boolean.TRUE.equals(answer.getEscalationRecommended()) || confidence < 0.4 || overlap < 0.15;
        return new ExamSnapshot(
                answer.getAnswer(),
                round(score),
                round(confidence),
                round(overlap),
                score >= threshold && !hallucinated,
                hallucinated
        );
    }

    private record ExamSnapshot(
            String aiAnswer,
            double score,
            double confidence,
            double overlap,
            boolean passed,
            boolean hallucinated
    ) {}

    private void createGapTasks(
            CoverageGap gap,
            String createdBy,
            boolean training,
            boolean evaluation,
            String materialHealth,
            boolean smartPolicy,
            boolean includeTraining,
            boolean includeBenchmark,
            LocalDateTime dueAt
    ) {
        if ("NO_MATERIAL".equals(materialHealth) || "MATERIAL_THIN".equals(materialHealth)) {
            return;
        }
        boolean doTraining = training;
        boolean doEval = evaluation;
        if (smartPolicy && "MATERIAL_OK".equals(materialHealth)) {
            doTraining = training && includeTraining;
            doEval = evaluation && includeBenchmark;
        }
        if (doTraining) {
            createAutomaticTask(gap, createdBy, "Soạn Q&A training theo giáo trình",
                    "Giáo trình là chuẩn. Soạn câu hỏi + tóm tắt ý từ sách (usage=TRAINING). Không viết đáp án thay sách.", dueAt);
        }
        if (doEval) {
            createAutomaticTask(gap, createdBy, "Soạn Q&A holdout theo giáo trình",
                    "Giáo trình là chuẩn. Soạn câu benchmark từ sách (usage=EVALUATION). Không index vào RAG.", dueAt);
        }
    }
    private void createAutomaticTask(CoverageGap gap, String createdBy, String title, String instructions, LocalDateTime dueAt) {
        CreateExpertTaskRequest request = new CreateExpertTaskRequest(); request.setCourseId(gap.getCourseId()); request.setChapter(gap.getChapter());
        request.setType("GOLD_QA"); request.setPriority("CRITICAL".equals(gap.getSeverity()) ? 100 : 70); request.setSourceGapId(gap.getId());
        request.setTitle(title + " - " + gap.getChapter()); request.setInstructions(instructions); request.setCreatedBy(createdBy);
        request.setDueAt(dueAt);
        createTask(request);
    }
    private ExpertTask task(String id) { return taskRepository.findById(requireText(id, "id")).orElseThrow(() -> new IllegalArgumentException("ExpertTask not found")); }
    private ExpertTask optionalTask(String id, String expectedType) {
        if (id == null || id.isBlank()) return null;
        ExpertTask task = task(id); if (!expectedType.equals(task.getType())) throw new IllegalArgumentException("Task type must be " + expectedType);
        if (Set.of("COMPLETED", "CANCELLED").contains(task.getStatus())) throw new IllegalArgumentException("Task is already closed"); return task;
    }
    private void attachContributionDraft(ExpertTask task, String contributionId) {
        if (task == null) return;
        task.setContributionId(contributionId);
        if (!"SUBMITTED".equals(task.getStatus()) && !"COMPLETED".equals(task.getStatus())) {
            task.setStatus("IN_PROGRESS");
        }
        task.setUpdatedAt(LocalDateTime.now());
        taskRepository.save(task);
    }

    private void completeContributionTask(ExpertTask task, String contributionId) {
        if (task == null) return;
        task.setContributionId(contributionId);
        task.setStatus("SUBMITTED");
        task.setUpdatedAt(LocalDateTime.now());
        taskRepository.save(task);
    }

    /**
     * Long chapters may have many Q&amp;A on one task. Keep the task open for more drafts
     * until every Gold Q&amp;A is indexed/approved (or still allow edits when rejected).
     */
    private void refreshTaskStatusAfterGoldChange(ExpertTask task, String contributionId) {
        if (task == null) return;
        if (contributionId != null && !contributionId.isBlank()) {
            task.setContributionId(contributionId);
        }
        List<GoldQa> items = goldQaRepository.findBySourceTaskId(task.getId());
        boolean hasEditable = items.stream()
                .anyMatch(item -> Set.of("DRAFT", "BASELINE_EXAMINED", "EXAMINED", "REJECTED").contains(item.getStatus()));
        boolean hasPending = items.stream()
                .anyMatch(item -> "PENDING_REVIEW".equals(item.getStatus()));
        boolean allAccepted = !items.isEmpty() && items.stream().allMatch(item ->
                "INDEXED".equals(item.getStatus())
                        || ("EVALUATION".equalsIgnoreCase(item.getUsage()) && "APPROVED".equals(item.getStatus()))
        );
        if (allAccepted) {
            task.setStatus("COMPLETED");
            task.setCompletedAt(LocalDateTime.now());
        } else if (hasPending && !hasEditable) {
            task.setStatus("SUBMITTED");
            task.setCompletedAt(null);
        } else {
            task.setStatus("IN_PROGRESS");
            task.setCompletedAt(null);
        }
        task.setUpdatedAt(LocalDateTime.now());
        taskRepository.save(task);
    }

    private Optional<GoldQa> resolveEditableGoldQa(String goldQaId, ExpertTask task, String authorId) {
        if (goldQaId == null || goldQaId.isBlank()) {
            return Optional.empty();
        }
        GoldQa existing = goldQaRepository.findById(goldQaId.trim())
                .orElseThrow(() -> new IllegalArgumentException("GoldQA not found"));
        if (!authorId.equals(existing.getAuthorId())) {
            throw new IllegalArgumentException("Only the author can update this Gold Q&A");
        }
        if (task != null && existing.getSourceTaskId() != null
                && !task.getId().equals(existing.getSourceTaskId())) {
            throw new IllegalArgumentException("Gold Q&A does not belong to this task");
        }
        if (!Set.of("DRAFT", "BASELINE_EXAMINED", "EXAMINED", "REJECTED").contains(existing.getStatus())) {
            throw new IllegalArgumentException("Gold Q&A cannot be edited in status " + existing.getStatus());
        }
        return Optional.of(existing);
    }

    private void completeReviewedTask(String taskId, boolean approved) {
        if (taskId == null || taskId.isBlank()) return;
        taskRepository.findById(taskId).ifPresent(task -> {
            if (!approved) {
                task.setStatus("IN_PROGRESS");
                task.setCompletedAt(null);
                task.setUpdatedAt(LocalDateTime.now());
                taskRepository.save(task);
                return;
            }
            refreshTaskStatusAfterGoldChange(task, task.getContributionId());
        });
    }

    private void ensurePending(String status) { if (!"PENDING_REVIEW".equals(status)) throw new IllegalArgumentException("Contribution is not pending review"); }
    private void ensureTeacherExamable(String status) {
        if (!Set.of("DRAFT", "BASELINE_EXAMINED", "REJECTED").contains(status)) {
            throw new IllegalArgumentException(
                    "Gold Q&A cannot be examined in status " + status
                            + ". Đã hết 2 lượt đánh giá hoặc đang chờ Senior — chỉ reset khi Senior từ chối."
            );
        }
    }
    private void ensureSenior(ExpertReviewRequest request) {
        if (request == null || !SENIOR_ROLES.contains(defaultText(request.getReviewerRole(), "").toUpperCase(Locale.ROOT))) throw new IllegalArgumentException("reviewerRole must be SENIOR_MENTOR or ADMIN");
        requireText(request.getReviewerId(), "reviewerId");
    }
    private String enumValue(String value, String field, Set<String> allowed) { String normalized = requireText(value, field).toUpperCase(Locale.ROOT); if (!allowed.contains(normalized)) throw new IllegalArgumentException(field + " must be one of " + allowed); return normalized; }
    private int positiveOrDefault(Integer value, int fallback) { return value == null ? fallback : Math.max(1, value); }
    private int clampPriority(Integer priority) { return priority == null ? 50 : Math.max(1, Math.min(100, priority)); }
    private LocalDateTime normalizeDueAt(LocalDateTime dueAt) {
        if (dueAt == null) {
            return null;
        }
        if (dueAt.isBefore(LocalDateTime.now())) {
            throw new IllegalArgumentException("dueAt must not be in the past");
        }
        return dueAt;
    }
    private String severity(String materialHealth, int materials, int training, int evaluation) {
        if ("NO_MATERIAL".equals(materialHealth) || materials == 0) {
            return "CRITICAL";
        }
        if ("MATERIAL_THIN".equals(materialHealth)) {
            return "HIGH";
        }
        if (training == 0 && evaluation == 0) {
            return "LOW";
        }
        if (training == 0 || evaluation == 0) {
            return "MEDIUM";
        }
        return "LOW";
    }
    private void validateWeights(Map<String, Double> weights) { if (weights == null || weights.isEmpty()) throw new IllegalArgumentException("criteriaWeights are required"); double sum = weights.values().stream().filter(Objects::nonNull).mapToDouble(Double::doubleValue).sum(); if (Math.abs(sum - 1.0) > 0.001) throw new IllegalArgumentException("criteriaWeights must sum to 1.0"); }
    private String defaultText(String value, String fallback) { return value == null || value.isBlank() ? fallback : value.trim(); }
    private double tokenOverlap(String expected, String actual) {
        Set<String> gold = tokens(expected); Set<String> answer = tokens(actual); if (gold.isEmpty()) return 0.0;
        long common = gold.stream().filter(answer::contains).count(); return common / (double) gold.size();
    }
    private Set<String> tokens(String text) { if (text == null) return Set.of(); return Arrays.stream(text.toLowerCase(Locale.ROOT).replaceAll("[^\\p{L}\\p{N}]+", " ").trim().split("\\s+")).filter(v -> v.length() > 2).collect(Collectors.toSet()); }
    private double round(double value) { return Math.round(value * 10000.0) / 10000.0; }
}
