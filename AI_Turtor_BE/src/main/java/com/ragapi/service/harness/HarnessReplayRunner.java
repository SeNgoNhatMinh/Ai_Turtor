package com.ragapi.service.harness;

import com.ragapi.dto.CourseRagAnswer;
import com.ragapi.entity.HarnessReplayCase;
import com.ragapi.service.course.gateway.CourseAnswerGateway;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.slf4j.MDC;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class HarnessReplayRunner {
    private static final int AUTO_LIMIT = 3;

    private final HarnessCaseService cases;
    private final CourseAnswerGateway courseAnswerGateway;

    @Async("adaptiveReviewExecutor")
    public void replayCourse(String courseId) {
        if (courseId == null || courseId.isBlank()) return;
        int replayed = 0;
        for (HarnessReplayCase item : cases.openCases(courseId.trim())) {
            if (replayed >= AUTO_LIMIT) break;
            try {
                replay(item.getId());
                replayed++;
            } catch (RuntimeException exception) {
                log.warn("Harness replay skipped for {}: {}", item.getId(), exception.getClass().getSimpleName());
            }
        }
    }

    public HarnessReplayCase replay(String id) {
        HarnessReplayCase item = cases.require(id);
        if (!"OPEN".equals(item.getStatus())) return item;
        String previousAi = MDC.get("aiTraceId");
        String previousFlag = MDC.get(HarnessCaseService.REPLAY_FLAG);
        String replayTraceId = UUID.randomUUID().toString();
        MDC.put("aiTraceId", replayTraceId);
        MDC.put(HarnessCaseService.REPLAY_FLAG, "true");
        try {
            CourseRagAnswer answer = courseAnswerGateway.askWithConfidence(
                    item.getQuestion(), item.getCourseId(), item.getClassId());
            String verdict = HarnessReplayVerdict.decide(
                    Boolean.TRUE.equals(answer.getEscalationRecommended()), answer.getAnswer());
            item.setReplayTraceId(replayTraceId);
            item.setReplayPreview(HarnessCaseService.previewOf(answer.getAnswer()));
            item.setVerdict(verdict);
            item.setVerdictNote(HarnessReplayVerdict.note(verdict));
        } catch (Exception exception) {
            item.setReplayTraceId(replayTraceId);
            item.setVerdict("WORSE");
            item.setVerdictNote("Lần chạy lại lỗi: " + exception.getClass().getSimpleName());
        } finally {
            restore("aiTraceId", previousAi);
            restore(HarnessCaseService.REPLAY_FLAG, previousFlag);
        }
        item.setStatus("REPLAYED");
        item.setReplayedAt(LocalDateTime.now());
        return cases.save(item);
    }

    private static void restore(String key, String previous) {
        if (previous == null || previous.isBlank()) MDC.remove(key);
        else MDC.put(key, previous);
    }
}
