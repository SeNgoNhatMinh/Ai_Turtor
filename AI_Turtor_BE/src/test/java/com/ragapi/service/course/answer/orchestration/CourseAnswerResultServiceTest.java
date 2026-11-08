package com.ragapi.service.course.answer.orchestration;

import com.ragapi.service.course.answer.policy.CourseAnswerRequestPolicyService;
import com.ragapi.service.course.model.CourseAnswerRequest;
import com.ragapi.service.course.model.RetrievedCourseChunk;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class CourseAnswerResultServiceTest {

    private final CourseAnswerResultService service =
            new CourseAnswerResultService(new CourseAnswerRequestPolicyService());

    @Test
    void finishedWorkReviewStillGradesWhenTheExcerptOmitsAMethod() {
        String question = """
                Học sinh đã nộp cả bài tập có hướng dẫn và quiz. Hãy sửa bài.
                doPost()
                getParameterValues()
                getParameterMap()
                """;

        assertTrue(service.validateGrounding(preparation(question, "doGet reads one query parameter.")).isEmpty());
    }

    @Test
    void ordinaryQuestionIsBlockedWhenTheExcerptOmitsTheCalledMethod() {
        var blocked = service.validateGrounding(preparation(
                "getParameterMap() trả về gì?",
                "doGet reads one query parameter."
        ));

        assertFalse(blocked.isEmpty());
        assertTrue(blocked.orElseThrow().getAnswer().contains("getparametermap()"));
    }

    private CourseAnswerPreparation preparation(String question, String context) {
        return new CourseAnswerPreparation(
                CourseAnswerRequest.builder().question(question).courseId("PRJ301").build(),
                0L,
                question,
                "PRJ301",
                question,
                List.of(new RetrievedCourseChunk(
                        context, 0.9, "material-1", "PRJ301", null, null, null, null, null,
                        null, null, null, null, null, null, null, null, null
                )),
                context,
                Map.of(),
                "TEXTBOOK",
                List.of("material-1"),
                0.9,
                true,
                true,
                false,
                null
        );
    }
}
