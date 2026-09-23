package com.ragapi.service.cotraining;

import com.ragapi.dto.cotraining.CoverageAnalysisRequest;
import com.ragapi.dto.cotraining.CreateExpertTaskRequest;
import com.ragapi.entity.CourseChapterOutline;
import com.ragapi.entity.CourseMaterial;
import com.ragapi.entity.CoverageGap;
import com.ragapi.repository.CourseMaterialRepository;
import com.ragapi.repository.CoverageGapRepository;
import com.ragapi.repository.GoldQaRepository;
import com.ragapi.service.ChapterOutlineService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.*;

import static com.ragapi.util.ValidationUtils.requireText;

@Service
@RequiredArgsConstructor
public class ExpertCoverageService {
    private final GoldQaRepository goldQaRepository;
    private final CoverageGapRepository gapRepository;
    private final CourseMaterialRepository materialRepository;
    private final ChapterOutlineService chapterOutlineService;
    private final ExpertTaskService taskService;

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

    public List<CoverageGap> list(String courseId) {
        return gapRepository.findByCourseIdOrderByDetectedAtDesc(requireText(courseId, "courseId"));
    }

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
        taskService.createTask(request);
    }
    private int positiveOrDefault(Integer value, int fallback) {
        return value == null ? fallback : Math.max(1, value);
    }

    private String severity(String materialHealth, int materials, int training, int evaluation) {
        if ("NO_MATERIAL".equals(materialHealth) || materials == 0) return "CRITICAL";
        if ("MATERIAL_THIN".equals(materialHealth)) return "HIGH";
        if (training == 0 && evaluation == 0) return "LOW";
        if (training == 0 || evaluation == 0) return "MEDIUM";
        return "LOW";
    }
}
