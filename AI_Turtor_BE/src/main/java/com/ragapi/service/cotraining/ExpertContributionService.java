package com.ragapi.service.cotraining;

import com.ragapi.dto.cotraining.*;
import com.ragapi.entity.ExpertRubric;
import com.ragapi.entity.ExpertTask;
import com.ragapi.entity.GoldQa;
import com.ragapi.repository.ExpertRubricRepository;
import com.ragapi.repository.GoldQaRepository;
import com.ragapi.service.RealtimeEventService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.*;

import static com.ragapi.util.ValidationUtils.*;

@Service
@RequiredArgsConstructor
public class ExpertContributionService {
    private static final Set<String> GOLD_USAGE = Set.of("TRAINING", "EVALUATION");
    private static final Set<String> DIFFICULTIES = Set.of("EASY", "MEDIUM", "HARD");
    private static final Set<String> SENIOR_ROLES = Set.of("SENIOR_MENTOR", "ADMIN");

    private final GoldQaRepository goldQaRepository;
    private final ExpertRubricRepository rubricRepository;
    private final RealtimeEventService realtimeEvents;
    private final ExpertTaskContributionService taskContributions;
    private final ExpertTeachingNoteService teachingNoteService;
    private final ExpertEvaluationService evaluationService;

    public GoldQa submitGoldQa(SubmitGoldQaRequest request) {
        if (request == null) throw new IllegalArgumentException("request is required");
        String usage = request.getUsage() == null || request.getUsage().isBlank()
                ? "TRAINING"
                : enumValue(request.getUsage(), "usage", GOLD_USAGE);
        String difficulty = enumValue(request.getDifficulty(), "difficulty", DIFFICULTIES);
        ExpertTask task = taskContributions.requireOpenTask(request.getSourceTaskId(), "GOLD_QA");
        LocalDateTime now = LocalDateTime.now();
        String authorId = requireText(request.getAuthorId(), "authorId");
        GoldQa gold = taskContributions.resolveEditableGoldQa(request.getGoldQaId(), task, authorId)
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
            evaluationService.clearExamResults(gold);
        }
        gold.setUpdatedAt(now);
        GoldQa saved = goldQaRepository.save(gold);
        taskContributions.attachDraft(task, saved.getId());
        return saved;
    }

    public GoldQa examGoldQa(String id) {
        GoldQa gold = goldQaRepository.findById(requireText(id, "id"))
                .orElseThrow(() -> new IllegalArgumentException("GoldQA not found"));
        ensureTeacherExamable(gold.getStatus());
        if ("EXAMINED".equals(gold.getStatus()) || Boolean.TRUE.equals(gold.getExamUsedTeachingNote())) {
            throw new IllegalArgumentException(
                    "Đã dùng đủ 2 lượt thi (lần 1 + thi lại). Chỉ được thi lại sau khi Senior từ chối và gửi về."
            );
        }
        if ("BASELINE_EXAMINED".equals(gold.getStatus())
                || (gold.getExamBaselineAiAnswer() != null && !gold.getExamBaselineAiAnswer().isBlank())) {
            evaluationService.examineWithTeachingNote(gold);
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
        evaluationService.examineBaseline(gold);
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
            taskContributions.refreshGoldTaskStatus(taskId, null);
        }
    }

    public GoldQa submitGoldQaAndExam(SubmitGoldQaRequest request) {
        return examGoldQa(submitGoldQa(request).getId());
    }

    public GoldQa sendGoldQaForReview(String id) {
        GoldQa gold = goldQaRepository.findById(requireText(id, "id"))
                .orElseThrow(() -> new IllegalArgumentException("GoldQA not found"));
        if (!"EXAMINED".equals(gold.getStatus())) {
            throw new IllegalArgumentException("Chỉ gửi Senior sau khi Cho AI thi lại (đã gắn ý chính giáo viên)");
        }
        if (!Boolean.TRUE.equals(gold.getExamUsedTeachingNote())) {
            throw new IllegalArgumentException("Chạy Cho AI thi lại với ý chính giáo viên trước khi gửi Senior");
        }
        if (gold.getExaminedAt() == null && gold.getExamAiAnswer() == null) {
            throw new IllegalArgumentException("Run exam before sending Gold Q&A to Senior");
        }
        gold.setStatus("PENDING_REVIEW");
        gold.setUpdatedAt(LocalDateTime.now());
        GoldQa saved = goldQaRepository.save(gold);
        ExpertTask task = taskContributions.requireOpenTask(saved.getSourceTaskId(), "GOLD_QA");
        taskContributions.refreshGoldTaskStatus(task, saved.getId());
        realtimeEvents.publishToRoles(SENIOR_ROLES, "GOLD_QA_SUBMITTED", "GOLD_QA", saved.getId(),
                saved.getStatus(), Map.of("courseId", saved.getCourseId(), "usage", saved.getUsage(),
                        "authorId", saved.getAuthorId(), "examPassed", Boolean.TRUE.equals(saved.getExamPassed())));
        return saved;
    }

    public ExpertRubric submitRubric(SubmitRubricRequest request) {
        if (request == null) throw new IllegalArgumentException("request is required");
        validateWeights(request.getCriteriaWeights());
        ExpertTask task = taskContributions.requireOpenTask(request.getSourceTaskId(), "RUBRIC");
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
        taskContributions.markSubmitted(task, rubric.getId());
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
            // Reset 2 exam attempts so Teacher can Cho AI thi + thi lại again after revising.
            evaluationService.clearExamResults(gold);
            gold.setStatus("REJECTED");
        } else if ("EVALUATION".equalsIgnoreCase(gold.getUsage())) {
            // Holdout only: never index teacher text into RAG (textbook remains sole factual source).
            gold.setStatus("APPROVED");
            gold.setHoldout(true);
            gold.setIndexedAt(null);
        } else {
            // TRAINING: Senior approves the second AI exam answer. The teacher's
            // goldAnswer remains guidance only and must never become the indexed answer.
            gold.setApprovedAnswer(requireText(gold.getExamAiAnswer(), "secondExamAiAnswer"));
            teachingNoteService.indexApproved(gold);
            gold.setStatus("INDEXED");
            gold.setIndexedAt(now);
            gold.setHoldout(false);
        }
        GoldQa saved = goldQaRepository.save(gold);
        taskContributions.refreshGoldTaskStatus(saved.getSourceTaskId(), saved.getId());
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
        taskContributions.completeReviewedTask(saved.getSourceTaskId(), approve);
        realtimeEvents.publishToUser(saved.getAuthorId(), approve ? "RUBRIC_APPROVED" : "RUBRIC_REJECTED",
                "EXPERT_RUBRIC", saved.getId(), saved.getStatus(), Map.of("courseId", saved.getCourseId()));
        return saved;
    }

    public List<GoldQa> listGoldQa(String courseId, String usage, String status) {
        return goldQaRepository.findByCourseIdOrderByCreatedAtDesc(requireText(courseId, "courseId")).stream()
                .filter(g -> usage == null || usage.isBlank() || usage.equalsIgnoreCase(g.getUsage()))
                .filter(g -> status == null || status.isBlank() || status.equalsIgnoreCase(g.getStatus())).toList();
    }

    public List<ExpertRubric> listRubrics(String courseId) {
        return rubricRepository.findByCourseIdOrderByCreatedAtDesc(requireText(courseId, "courseId"));
    }

    private void ensurePending(String status) {
        if (!"PENDING_REVIEW".equals(status)) {
            throw new IllegalArgumentException("Contribution is not pending review");
        }
    }

    private void ensureTeacherExamable(String status) {
        if (!Set.of("DRAFT", "BASELINE_EXAMINED", "REJECTED").contains(status)) {
            throw new IllegalArgumentException(
                    "Gold Q&A cannot be examined in status " + status
                            + ". Đã hết 2 lượt thi hoặc đang chờ Senior — chỉ reset khi Senior từ chối."
            );
        }
    }

    private void ensureSenior(ExpertReviewRequest request) {
        if (request == null || !SENIOR_ROLES.contains(
                defaultText(request.getReviewerRole(), "").toUpperCase(Locale.ROOT))) {
            throw new IllegalArgumentException("reviewerRole must be SENIOR_MENTOR or ADMIN");
        }
        requireText(request.getReviewerId(), "reviewerId");
    }

    private String enumValue(String value, String field, Set<String> allowed) {
        String normalized = requireText(value, field).toUpperCase(Locale.ROOT);
        if (!allowed.contains(normalized)) {
            throw new IllegalArgumentException(field + " must be one of " + allowed);
        }
        return normalized;
    }

    private void validateWeights(Map<String, Double> weights) {
        if (weights == null || weights.isEmpty()) {
            throw new IllegalArgumentException("criteriaWeights are required");
        }
        double sum = weights.values().stream().filter(Objects::nonNull).mapToDouble(Double::doubleValue).sum();
        if (Math.abs(sum - 1.0) > 0.001) {
            throw new IllegalArgumentException("criteriaWeights must sum to 1.0");
        }
    }

    private String defaultText(String value, String fallback) {
        return value == null || value.isBlank() ? fallback : value.trim();
    }
}
