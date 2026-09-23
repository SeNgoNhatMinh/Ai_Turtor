package com.ragapi.service.course.answer.orchestration;

import com.ragapi.dto.CourseRagAnswer;
import com.ragapi.service.course.answer.policy.CourseAnswerRequestPolicyService;
import com.ragapi.util.GroundedContentGuard;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Optional;
import java.util.Set;

/** Applies post-retrieval guards and builds consistent answer outcomes. */
@Slf4j
@Service
@RequiredArgsConstructor
public class CourseAnswerResultService {

    private static final double MIN_GROUNDED_CONFIDENCE = 0.6;

    private final CourseAnswerRequestPolicyService requestPolicyService;

    public Optional<CourseRagAnswer> validateGrounding(CourseAnswerPreparation prepared) {
        if (prepared.chunks().isEmpty()) {
            return Optional.of(blocked(
                    "Hệ thống chưa có tài liệu của môn " + prepared.courseId()
                            + " để AI Tutor trả lời. Câu hỏi sẽ được chuyển cho giáo viên/mentor phụ trách.",
                    0.0,
                    List.of(),
                    "No course material context was found"
            ));
        }

        Set<String> unsupportedCallReferences = GroundedContentGuard.unsupportedCallReferences(
                prepared.question(),
                prepared.context()
        );
        if (!unsupportedCallReferences.isEmpty()) {
            String unsupported = String.join(", ", unsupportedCallReferences);
            log.warn("RAG answer blocked because explicit technical references are absent from course material: {}",
                    unsupported);
            return Optional.of(blocked(
                    "Tài liệu hiện có của môn " + prepared.courseId() + " không đề cập đến " + unsupported
                            + ", nên AI Tutor không tạo phần giải thích, kiểm tra hiểu hoặc gợi ý học thêm để tránh tự suy đoán. "
                            + "Câu hỏi sẽ được chuyển cho giáo viên/mentor phụ trách.",
                    Math.min(prepared.confidence(), 0.45),
                    prepared.sourceLabels(),
                    "Explicit technical reference is absent from course material: " + unsupported
            ));
        }

        if (requestPolicyService.asksForUnsupportedExpansion(prepared.question(), prepared.context())) {
            log.warn("RAG answer blocked because the student asks beyond available course material scope (question={})",
                    prepared.question());
            return Optional.of(blocked(
                    "Tài liệu hiện có chỉ đủ để giải thích ở mức ví dụ/khái niệm, chưa đủ dữ liệu để đưa ra dự án thực tế hoặc yêu cầu chi tiết như bạn hỏi. Mình sẽ chuyển câu hỏi này cho giáo viên/mentor phụ trách để tránh AI tự suy đoán ngoài tài liệu.",
                    Math.min(prepared.confidence(), 0.4),
                    prepared.sourceLabels(),
                    "Question asks beyond available course material scope"
            ));
        }

        if (prepared.confidence() < MIN_GROUNDED_CONFIDENCE || !prepared.grounded()) {
            String reason = !prepared.grounded()
                    ? "Retrieved course material is not relevant enough to the question"
                    : "Low retrieval confidence";
            log.warn(
                    "RAG answer blocked because grounding is insufficient (confidence={}, grounded={}, sources={})",
                    prepared.confidence(),
                    prepared.grounded(),
                    prepared.sourceLabels()
            );
            return Optional.of(blocked(
                    "Tài liệu hiện có của môn " + prepared.courseId()
                            + " không có nội dung đủ phù hợp để trả lời chắc chắn. Câu hỏi sẽ được chuyển cho giáo viên/mentor phụ trách để tránh AI trả lời ngoài phạm vi tài liệu.",
                    Math.min(prepared.confidence(), 0.45),
                    prepared.sourceLabels(),
                    reason
            ));
        }
        return Optional.empty();
    }

    public CourseRagAnswer softUnavailable(String answer, List<String> sources) {
        return CourseRagAnswer.builder()
                .answer(answer)
                .confidence(0.0)
                .sources(sources == null ? List.of() : sources)
                .sourceEvidence(List.of())
                .groundingType("NONE")
                .escalationRecommended(false)
                .escalationReason(null)
                .build();
    }

    public CourseRagAnswer blocked(String answer, double confidence, List<String> sources, String reason) {
        return CourseRagAnswer.builder()
                .answer(answer)
                .confidence(confidence)
                .sources(sources == null ? List.of() : sources)
                .sourceEvidence(List.of())
                .groundingType("NONE")
                .escalationRecommended(true)
                .escalationReason(reason)
                .build();
    }
}
