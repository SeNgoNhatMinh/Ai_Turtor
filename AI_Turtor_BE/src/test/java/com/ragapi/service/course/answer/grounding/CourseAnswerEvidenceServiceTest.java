package com.ragapi.service.course.answer.grounding;

import com.ragapi.service.course.answer.grounding.evidence.CourseAnswerEvidenceSelector;
import com.ragapi.service.course.answer.grounding.evidence.CourseAnswerSourceService;
import com.ragapi.service.course.model.RetrievedCourseChunk;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class CourseAnswerEvidenceServiceTest {

    private static final String QUESTION = "Giải thích Cấu trúc rẽ nhánh & Vòng lặp bằng ví dụ đơn giản.";

    private final CourseAnswerEvidenceSelector selector = mock(CourseAnswerEvidenceSelector.class);
    private final CourseAnswerEvidenceService service =
            new CourseAnswerEvidenceService(mock(CourseAnswerSourceService.class), selector);

    private static RetrievedCourseChunk chunk(String id, String content) {
        return new RetrievedCourseChunk(content, 0.8, "material-" + id, "PFP191", null, "teacher",
                "COURSE_SHARED", null, "doc", null, null, null, null, id, 0, "CHUNK");
    }

    @Test
    void keepsTheChunkBehindTheQuizAlongsideTheLessonEvidence() {
        RetrievedCourseChunk lesson = chunk("if", "if x > 0: print('x is positive')");
        RetrievedCourseChunk files = chunk("files", "for line in fhand: line = line.rstrip()");
        String answer = "## Rẽ nhánh\nGiải thích if.\n\n## Kiểm tra hiểu\n\nQ1.\ncontinue với rstrip()?\n\n## Học chuyên sâu\n- Vòng lặp";
        when(selector.selectAnswerEvidenceChunks(anyList(), eq(QUESTION), eq(answer))).thenReturn(List.of(lesson));
        when(selector.selectAnswerEvidenceChunks(anyList(), eq(QUESTION), contains("rstrip()")))
                .thenAnswer(invocation -> ((String) invocation.getArgument(2)).contains("Học chuyên sâu")
                        ? List.of(lesson)
                        : List.of(files));

        List<RetrievedCourseChunk> evidence = service.selectAnswerEvidenceChunks(List.of(lesson, files), QUESTION, answer);

        assertEquals(List.of(lesson, files), evidence);
    }

    @Test
    void fallsBackToTopRetrievedChunksWhenTheQuizCannotBeAligned() {
        RetrievedCourseChunk first = chunk("a", "English material one");
        RetrievedCourseChunk second = chunk("b", "English material two");
        when(selector.selectAnswerEvidenceChunks(anyList(), anyString(), anyString())).thenReturn(List.of());

        List<RetrievedCourseChunk> evidence = service.selectAnswerEvidenceChunks(
                List.of(first, second), QUESTION, "Bài giảng.\n\n## Kiểm tra hiểu\n\nQ1.\nCâu hỏi?");

        assertEquals(List.of(first, second), evidence);
    }

    @Test
    void answersWithoutAQuizKeepTheStrictLessonEvidence() {
        RetrievedCourseChunk unrelated = chunk("a", "English material");
        when(selector.selectAnswerEvidenceChunks(anyList(), anyString(), anyString())).thenReturn(List.of());

        assertTrue(service.selectAnswerEvidenceChunks(List.of(unrelated), QUESTION, "Chỉ có bài giảng.").isEmpty());
    }
}
