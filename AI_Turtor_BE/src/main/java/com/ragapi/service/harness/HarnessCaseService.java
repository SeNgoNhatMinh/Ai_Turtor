package com.ragapi.service.harness;

import com.ragapi.entity.GoldQa;
import com.ragapi.entity.HarnessReplayCase;
import com.ragapi.repository.HarnessReplayCaseRepository;
import com.ragapi.service.course.model.CourseAnswerRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.slf4j.MDC;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Locale;

@Slf4j
@Service
@RequiredArgsConstructor
public class HarnessCaseService {
    static final String REPLAY_FLAG = "harnessReplay";

    private final HarnessReplayCaseRepository repository;

    public void captureAnswer(CourseAnswerRequest request, String traceId, String reason, String preview) {
        if (request == null || isReplay()) return;
        try {
            open(request.courseId(), request.classId(), null, request.question(), reason, traceId, preview);
        } catch (RuntimeException exception) {
            log.warn("Could not store harness case: {}", exception.getClass().getSimpleName());
        }
    }

    public void captureLowEval(GoldQa gold) {
        if (gold == null || Boolean.TRUE.equals(gold.getExamPassed()) || isReplay()) return;
        try {
            open(gold.getCourseId(), null, gold.getChapter(), gold.getQuestion(), "LOW_EVAL", null, gold.getExamAiAnswer());
        } catch (RuntimeException exception) {
            log.warn("Could not store low-eval harness case: {}", exception.getClass().getSimpleName());
        }
    }

    public List<HarnessReplayCase> list(String courseId) {
        if (courseId == null || courseId.isBlank()) {
            throw new IllegalArgumentException("courseId is required");
        }
        return repository.findByCourseIdOrderByCreatedAtDesc(courseId.trim());
    }

    public List<HarnessReplayCase> openCases(String courseId) {
        return repository.findByCourseIdAndStatusOrderByCreatedAtAsc(courseId, "OPEN");
    }

    public HarnessReplayCase require(String id) {
        return repository.findById(id).orElseThrow(() -> new IllegalArgumentException("Harness case not found"));
    }

    public HarnessReplayCase save(HarnessReplayCase item) {
        return repository.save(item);
    }

    private void open(String courseId, String classId, String chapter, String question, String reason, String traceId, String preview) {
        String safeCourse = courseId == null ? "" : courseId.trim();
        String safeQuestion = question == null ? "" : question.trim();
        if (safeCourse.isBlank() || safeQuestion.isBlank()) return;
        String key = (reason + "|" + safeQuestion).toLowerCase(Locale.ROOT);
        if (repository.findFirstByCourseIdAndQuestionKeyAndStatus(safeCourse, key, "OPEN").isPresent()) return;
        repository.save(HarnessReplayCase.builder()
                .courseId(safeCourse)
                .classId(classId)
                .chapter(chapter)
                .question(safeQuestion.length() > 500 ? safeQuestion.substring(0, 500) : safeQuestion)
                .questionKey(key.length() > 540 ? key.substring(0, 540) : key)
                .reason(reason)
                .status("OPEN")
                .sourceTraceId(traceId)
                .sourcePreview(previewOf(preview))
                .createdAt(LocalDateTime.now())
                .build());
    }

    static String previewOf(String value) {
        if (value == null || value.isBlank()) return "";
        String text = value.trim().replaceAll("\\s+", " ");
        return text.length() > 400 ? text.substring(0, 400) + "…" : text;
    }

    private static boolean isReplay() {
        return "true".equals(MDC.get(REPLAY_FLAG));
    }
}
