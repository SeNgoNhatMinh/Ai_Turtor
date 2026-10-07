package com.ragapi.service.course.answer.grounding;

import com.ragapi.service.course.model.RetrievedCourseChunk;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertFalse;
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

    @Test
    void vietnameseRequestToLearnObjectsIsGroundedByTheTextbookChapter() {
        CourseAnswerGroundingService service = new CourseAnswerGroundingService();
        RetrievedCourseChunk chunk = new RetrievedCourseChunk(
                "Chapter 14 Object-oriented programming. We use the class keyword. class PartyAnimal: an = PartyAnimal()",
                0.9,
                "material",
                "PFP191",
                null,
                "teacher",
                "COURSE_SHARED"
        );
        String context = chunk.content();

        assertTrue(service.assess(
                "Tôi muốn học về cách tạo object",
                "Tôi muốn học về cách tạo object",
                context,
                List.of(chunk),
                false
        ).grounded());
        assertTrue(service.assess(
                "Hôm nay tôi muốn học về cách tạo class",
                "Hôm nay tôi muốn học về cách tạo class",
                context,
                List.of(chunk),
                false
        ).grounded());
        assertFalse(service.assess(
                "Tôi muốn học về cách tạo widget",
                "Tôi muốn học về cách tạo widget",
                context,
                List.of(chunk),
                false
        ).grounded());
    }
}
