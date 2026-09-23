package com.ragapi.service.cotraining;

import com.ragapi.dto.CourseRagAnswer;
import com.ragapi.dto.cotraining.StartEvalRunRequest;
import com.ragapi.entity.EvalResult;
import com.ragapi.entity.EvalRun;
import com.ragapi.entity.GoldQa;
import com.ragapi.repository.EvalResultRepository;
import com.ragapi.repository.EvalRunRepository;
import com.ragapi.repository.GoldQaRepository;
import com.ragapi.service.RealtimeEventService;
import com.ragapi.service.course.gateway.CourseAnswerGateway;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;

import static com.ragapi.util.ValidationUtils.requireText;

/** Runs deterministic Gold Q&A exams and offline evaluation suites. */
@Service
@RequiredArgsConstructor
public class ExpertEvaluationService {
    private static final Set<String> SENIOR_ROLES = Set.of("SENIOR_MENTOR", "ADMIN");

    private final GoldQaRepository goldQaRepository;
    private final EvalRunRepository evalRunRepository;
    private final EvalResultRepository evalResultRepository;
    private final CourseAnswerGateway courseAnswerService;
    private final RealtimeEventService realtimeEvents;

    public EvalRun run(StartEvalRunRequest request) {
        String courseId = requireText(request == null ? null : request.getCourseId(), "courseId");
        double threshold = request.getPassThreshold() == null
                ? 0.6
                : Math.max(0.0, Math.min(1.0, request.getPassThreshold()));
        List<GoldQa> cases = goldQaRepository
                .findByCourseIdAndUsageAndStatus(courseId, "EVALUATION", "APPROVED").stream()
                .filter(gold -> request.getChapter() == null
                        || request.getChapter().isBlank()
                        || request.getChapter().equalsIgnoreCase(gold.getChapter()))
                .toList();
        if (cases.isEmpty()) {
            throw new IllegalArgumentException("No approved evaluation holdout cases found");
        }

        LocalDateTime now = LocalDateTime.now();
        Optional<EvalRun> baseline = evalRunRepository
                .findFirstByCourseIdAndStatusOrderByCompletedAtDesc(courseId, "PASSED");
        EvalRun run = evalRunRepository.save(EvalRun.builder()
                .courseId(courseId)
                .chapter(request.getChapter())
                .status("RUNNING")
                .harnessVersion(defaultText(request.getHarnessVersion(), "v2-mvp-deterministic"))
                .kbVersion(defaultText(request.getKbVersion(), "current"))
                .promptVersion(defaultText(request.getPromptVersion(), "current"))
                .totalCases(cases.size())
                .passThreshold(threshold)
                .baselineRunId(baseline.map(EvalRun::getId).orElse(null))
                .triggeredBy(request.getTriggeredBy())
                .createdAt(now)
                .startedAt(now)
                .build());

        try {
            List<EvalResult> results = new ArrayList<>();
            for (GoldQa gold : cases) {
                results.add(evaluate(run, gold, threshold));
            }
            evalResultRepository.saveAll(results);
            double average = results.stream().mapToDouble(EvalResult::getScore).average().orElse(0.0);
            long hallucinated = results.stream().filter(result -> Boolean.TRUE.equals(result.getHallucinated())).count();
            int passed = (int) results.stream().filter(result -> Boolean.TRUE.equals(result.getPassed())).count();
            boolean regression = baseline
                    .map(previous -> previous.getAverageScore() != null && average < previous.getAverageScore() - 0.05)
                    .orElse(false);

            run.setPassedCases(passed);
            run.setAverageScore(round(average));
            run.setHallucinationRate(round(hallucinated / (double) results.size()));
            run.setRegressionDetected(regression);
            run.setMetrics(Map.of(
                    "accuracy", round(passed / (double) results.size()),
                    "averageScore", round(average)
            ));
            run.setStatus(average >= threshold && !regression ? "PASSED" : "FAILED");
            run.setCompletedAt(LocalDateTime.now());
            EvalRun saved = evalRunRepository.save(run);
            realtimeEvents.publishToRoles(
                    SENIOR_ROLES, "EVAL_RUN_COMPLETED", "EVAL_RUN", saved.getId(), saved.getStatus(),
                    Map.of("courseId", saved.getCourseId(), "averageScore", saved.getAverageScore())
            );
            return saved;
        } catch (Exception exception) {
            run.setStatus("ERROR");
            run.setError(exception.getMessage());
            run.setCompletedAt(LocalDateTime.now());
            EvalRun saved = evalRunRepository.save(run);
            realtimeEvents.publishToRoles(
                    SENIOR_ROLES, "EVAL_RUN_FAILED", "EVAL_RUN", saved.getId(), saved.getStatus(),
                    Map.of("courseId", saved.getCourseId())
            );
            return saved;
        }
    }

    public List<EvalRun> listRuns(String courseId) {
        return evalRunRepository.findByCourseIdOrderByCreatedAtDesc(requireText(courseId, "courseId"));
    }

    public Map<String, Object> runDetail(String id) {
        EvalRun run = evalRunRepository.findById(requireText(id, "id"))
                .orElseThrow(() -> new IllegalArgumentException("EvalRun not found"));
        return Map.of(
                "run", run,
                "results", evalResultRepository.findByEvalRunIdOrderByCreatedAtAsc(run.getId())
        );
    }

    public void examineBaseline(GoldQa gold) {
        try {
            ExamSnapshot exam = scoreAgainstTextbookBaseline(gold, 0.6);
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
            markExamFailed(gold, error, false);
        }
    }

    public void examineWithTeachingNote(GoldQa gold) {
        try {
            String baseline = gold.getExamBaselineAiAnswer();
            if (baseline == null || baseline.isBlank()) {
                baseline = gold.getExamAiAnswer();
            }
            ExamSnapshot exam = scoreSynthesizedExam(gold, baseline, 0.6);
            double keptScore = gold.getExamBaselineScore() == null
                    ? exam.score()
                    : Math.max(exam.score(), gold.getExamBaselineScore());
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
            markExamFailed(gold, error, true);
        }
    }

    public void clearExamResults(GoldQa gold) {
        if (gold == null) {
            return;
        }
        gold.setApprovedAnswer(null);
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

    private EvalResult evaluate(EvalRun run, GoldQa gold, double threshold) throws Exception {
        ExamSnapshot exam = scoreAgainstCurrentRag(gold, threshold);
        return EvalResult.builder()
                .evalRunId(run.getId())
                .goldQaId(gold.getId())
                .courseId(gold.getCourseId())
                .chapter(gold.getChapter())
                .question(gold.getQuestion())
                .goldAnswer(gold.getGoldAnswer())
                .aiAnswer(exam.aiAnswer())
                .score(exam.score())
                .ragConfidence(exam.confidence())
                .passed(exam.passed())
                .hallucinated(exam.hallucinated())
                .criterionScores(Map.of("tokenOverlap", exam.overlap(), "ragConfidence", exam.confidence()))
                .createdAt(LocalDateTime.now())
                .build();
    }

    private void markExamFailed(GoldQa gold, Exception error, boolean usedTeachingNote) {
        gold.setExamError(error.getMessage() == null ? "Exam failed" : error.getMessage());
        gold.setExamPassed(false);
        gold.setExamUsedTeachingNote(usedTeachingNote);
        gold.setExaminedAt(LocalDateTime.now());
        gold.setUpdatedAt(LocalDateTime.now());
        goldQaRepository.save(gold);
    }

    private ExamSnapshot scoreSynthesizedExam(GoldQa gold, String baselineAnswer, double threshold) throws Exception {
        CourseRagAnswer answer = courseAnswerService.askWithConfidenceSynthesizingExam(
                gold.getQuestion(), gold.getCourseId(), null, gold.getChapter(), gold.getGoldAnswer(), baselineAnswer
        );
        return scoreAnswer(gold, answer, threshold);
    }

    private ExamSnapshot scoreAgainstCurrentRag(GoldQa gold, double threshold) throws Exception {
        return scoreAnswer(gold, courseAnswerService.askWithConfidence(
                gold.getQuestion(), gold.getCourseId(), null
        ), threshold);
    }

    private ExamSnapshot scoreAgainstTextbookBaseline(GoldQa gold, double threshold) throws Exception {
        return scoreAnswer(gold, courseAnswerService.askWithConfidenceFromTextbook(
                gold.getQuestion(), gold.getCourseId(), null
        ), threshold);
    }

    private ExamSnapshot scoreAnswer(GoldQa gold, CourseRagAnswer answer, double threshold) {
        double overlap = tokenOverlap(gold.getGoldAnswer(), answer.getAnswer());
        double confidence = answer.getConfidence() == null ? 0.0 : answer.getConfidence();
        double score = round(overlap * 0.75 + confidence * 0.25);
        boolean hallucinated = Boolean.TRUE.equals(answer.getEscalationRecommended())
                || confidence < 0.4
                || overlap < 0.15;
        return new ExamSnapshot(
                answer.getAnswer(), round(score), round(confidence), round(overlap),
                score >= threshold && !hallucinated, hallucinated
        );
    }

    private String defaultText(String value, String fallback) {
        return value == null || value.isBlank() ? fallback : value.trim();
    }

    private double tokenOverlap(String expected, String actual) {
        Set<String> gold = tokens(expected);
        Set<String> answer = tokens(actual);
        if (gold.isEmpty()) {
            return 0.0;
        }
        long common = gold.stream().filter(answer::contains).count();
        return common / (double) gold.size();
    }

    private Set<String> tokens(String text) {
        if (text == null) {
            return Set.of();
        }
        return Arrays.stream(text.toLowerCase(Locale.ROOT)
                        .replaceAll("[^\\p{L}\\p{N}]+", " ")
                        .trim()
                        .split("\\s+"))
                .filter(value -> value.length() > 2)
                .collect(Collectors.toSet());
    }

    private double round(double value) {
        return Math.round(value * 10000.0) / 10000.0;
    }

    private record ExamSnapshot(
            String aiAnswer,
            double score,
            double confidence,
            double overlap,
            boolean passed,
            boolean hallucinated
    ) {}
}
