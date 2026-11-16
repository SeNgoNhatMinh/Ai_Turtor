package com.ragapi.service.behavior.plan;

import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class StudentLearningContextServiceTest {

    @Test
    void topicRelevantMatchesSharedTokens() {
        assertThat(StudentLearningContextService.topicRelevant("Java for loop", "for loop", "điều kiện vòng lặp"))
                .isTrue();
        assertThat(StudentLearningContextService.topicRelevant("SQL join", "for loop", "vòng lặp for"))
                .isFalse();
    }

    @Test
    void sameQuestionDifferentContextsProduceDifferentPromptBlocks() {
        String question = "Giải thích Java for loop";
        StudentLearningContext studentA = new StudentLearningContext(
                "a", "PRJ301", "SE1", "Java for loop",
                List.of("Confuses loop condition and update"),
                List.of("Loop condition vs update"),
                List.of(),
                List.of("Em hỏi lại for loop"),
                List.of("Java for loop → struggled (40%)"),
                "CONFUSED",
                """
                STUDENT LEARNING CONTEXT
                - Relevant unresolved difficulties: Confuses loop condition and update
                - Temporary interaction signal: CONFUSED
                """
        );
        StudentLearningContext studentB = new StudentLearningContext(
                "b", "PRJ301", "SE1", "Java for loop",
                List.of("Can explain theory but cannot implement"),
                List.of(),
                List.of("Explains for-loop parts correctly"),
                List.of(),
                List.of("Java for loop → demonstrated (85%)"),
                "NEUTRAL",
                """
                STUDENT LEARNING CONTEXT
                - Demonstrated strengths: Explains for-loop parts correctly
                - Relevant unresolved difficulties: Can explain theory but cannot implement
                """
        );
        StudentLearningContext studentC = new StudentLearningContext(
                "c", "PRJ301", "SE1", "Java for loop",
                List.of(),
                List.of(),
                List.of("Completed for-loop drills"),
                List.of(),
                List.of("Java for loop → demonstrated (95%)"),
                "CURIOUS",
                """
                STUDENT LEARNING CONTEXT
                - Demonstrated strengths: Completed for-loop drills
                - Temporary interaction signal: CURIOUS
                """
        );

        assertThat(studentA.promptBlock()).isNotEqualTo(studentB.promptBlock());
        assertThat(studentB.promptBlock()).isNotEqualTo(studentC.promptBlock());
        assertThat(studentA.promptBlock()).contains("CONFUSED").contains("condition");
        assertThat(studentB.promptBlock()).contains("cannot implement").doesNotContain("CONFUSED");
        assertThat(studentC.promptBlock()).contains("CURIOUS").contains("Completed");
        assertThat(question).isNotBlank();
    }
}
