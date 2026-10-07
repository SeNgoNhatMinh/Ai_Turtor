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
        RetrievedCourseChunk unrelated = new RetrievedCourseChunk(
                chunk.content(),
                0.4,
                "material",
                "PFP191",
                null,
                "teacher",
                "COURSE_SHARED"
        );
        assertFalse(service.assess(
                "Tôi muốn học về cách tạo widget",
                "Tôi muốn học về cách tạo widget",
                unrelated.content(),
                List.of(unrelated),
                false
        ).grounded());
    }

    @Test
    void samePassageCoversDifferentWordingsWhenRetrievalSelectedIt() {
        CourseAnswerGroundingService service = new CourseAnswerGroundingService();
        RetrievedCourseChunk chunk = new RetrievedCourseChunk(
                "A pointer stores a memory address.",
                0.82,
                "material",
                "CEA201",
                null,
                "teacher",
                "COURSE_SHARED"
        );
        String context = chunk.content();

        assertTrue(service.assess(
                "Con trỏ trong C là gì?",
                "Con trỏ trong C là gì?",
                context,
                List.of(chunk),
                false
        ).grounded());
        assertTrue(service.assess(
                "Biến tham chiếu này hoạt động thế nào?",
                "Biến tham chiếu này hoạt động thế nào?",
                context,
                List.of(chunk),
                false
        ).grounded());
        assertTrue(service.assess(
                "Hàm trong chương trình dùng để làm gì?",
                "Hàm trong chương trình dùng để làm gì?",
                "A function is a named sequence of statements.",
                List.of(new RetrievedCourseChunk(
                        "A function is a named sequence of statements.",
                        0.8,
                        "material",
                        "PFP191",
                        null,
                        "teacher",
                        "COURSE_SHARED"
                )),
                false
        ).grounded());

        RetrievedCourseChunk notSelected = new RetrievedCourseChunk(
                context,
                0.4,
                "material",
                "CEA201",
                null,
                "teacher",
                "COURSE_SHARED"
        );
        assertFalse(service.assess(
                "Thời tiết hôm nay thế nào?",
                "Thời tiết hôm nay thế nào?",
                context,
                List.of(notSelected),
                false
        ).grounded());
    }
}
