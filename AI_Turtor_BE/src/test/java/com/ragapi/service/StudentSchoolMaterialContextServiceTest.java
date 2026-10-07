package com.ragapi.service;

import com.ragapi.dto.StudentSchoolExcerpt;
import com.ragapi.service.course.model.RetrievedCourseChunk;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class StudentSchoolMaterialContextServiceTest {

    @Test
    void schoolPassageKeepsTextbookTextAndDropsInternalFields() {
        RetrievedCourseChunk chunk = new RetrievedCourseChunk(
                "A pointer stores a memory address.",
                0.91,
                "6a7dceb640aabc73aa4611c4",
                "PRF192",
                "PRF192-01",
                "teacher-1",
                "COURSE_SHARED",
                "TEXTBOOK",
                "doc",
                "chapter-5",
                "Chapter 5 - Addresses and Pointers",
                "section",
                "Pointers",
                "chunk-9",
                3,
                "CHUNK"
        );

        List<StudentSchoolExcerpt> excerpts = StudentSchoolMaterialContextService.project(List.of(chunk));

        assertThat(excerpts).containsExactly(new StudentSchoolExcerpt(
                "Chapter 5 - Addresses and Pointers",
                "A pointer stores a memory address."
        ));
    }

    @Test
    void secretShapedPassageIsNotSentToTheStudentLlm() {
        RetrievedCourseChunk secret = new RetrievedCourseChunk(
                "token sk-or-abcdefghijklmnopqrstuvwxyz",
                0.99,
                "material",
                "PRF192",
                null,
                "teacher",
                "COURSE_SHARED"
        );
        RetrievedCourseChunk textbook = new RetrievedCourseChunk(
                "Pointers store an address.",
                0.8,
                "material",
                "PRF192",
                null,
                "teacher",
                "COURSE_SHARED"
        );

        List<StudentSchoolExcerpt> excerpts = StudentSchoolMaterialContextService.project(List.of(secret, textbook));

        assertThat(excerpts).extracting(StudentSchoolExcerpt::text)
                .containsExactly("Pointers store an address.");
    }

    @Test
    void personalLlmLessonUsesTheProjectHeadingsWithoutInternalIds() {
        String instruction = StudentOwnedLlmService.lessonInstruction("HIGH_SUPPORT");

        assertThat(instruction).contains("## Giải thích", "## Ví dụ nhỏ", "## Kiểm tra hiểu", "## Học chuyên sâu");
        assertThat(instruction).contains("Đáp án:");
        assertThat(instruction).contains("HIGH_SUPPORT");
        assertThat(instruction).doesNotContain("materialId", "Teacher guidance");
        assertThat(StudentOwnedLlmService.lessonInstruction("unknown")).contains("STANDARD");
    }

    @Test
    void unknownProviderIsRejectedBeforeAnyCall() {
        assertThatThrownBy(() -> StudentOwnedLlmService.endpointFor("https://evil.example"))
                .isInstanceOf(IllegalArgumentException.class);
        assertThat(StudentOwnedLlmService.endpointFor("OpenRouter"))
                .isEqualTo("https://openrouter.ai/api/v1/chat/completions");
    }
}
