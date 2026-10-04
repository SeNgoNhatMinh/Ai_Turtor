package com.ragapi.service.course.answer.grounding;

import com.ragapi.service.course.model.RetrievedCourseChunk;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertTrue;

class CourseAnswerGroundingServiceTest {

    @Test
    void vietnameseMethodComparisonIsGroundedByEnglishMethodCall() {
        CourseAnswerGroundingService service = new CourseAnswerGroundingService();
        RetrievedCourseChunk chunk = new RetrievedCourseChunk(
                "The append method modifies a list, but the + operator creates a new list: t1.append(3).",
                0.9,
                "material",
                "PFP191",
                null,
                "teacher",
                "COURSE_SHARED"
        );

        var assessment = service.assess(
                "So sánh toán tử + vs append khi nào tạo đối tượng mới",
                "So sánh toán tử + vs append khi nào tạo đối tượng mới",
                chunk.content(),
                List.of(chunk),
                false
        );

        assertTrue(assessment.grounded());
    }
}
