package com.ragapi.harness.util;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class PromptTokenBudgetTest {

    @Test
    void leavesAPromptThatAlreadyFitsUntouched() {
        String prompt = """
                COURSE MATERIAL CONTEXT:
                Files store bytes.
                STUDENT QUESTION:
                Bài 3: Files
                """;

        assertEquals(prompt, PromptTokenBudget.fit(prompt, 5_000));
    }

    @Test
    void keepsTheChapterWhenTheInstructionBlockIsWhatOverflows() {
        String chapter = "Files store bytes on disk. " + "A stream reads one byte at a time. ".repeat(80);
        String prompt = "RULE ".repeat(12_000)
                + "\nCOURSE MATERIAL CONTEXT:\n"
                + chapter
                + "\nSTUDENT QUESTION:\nBài 3: Files";

        String fitted = PromptTokenBudget.fit(prompt, 5_000);

        assertTrue(fitted.length() <= 5_000 * PromptTokenBudget.CHARS_PER_TOKEN);
        assertTrue(fitted.contains(chapter));
        assertTrue(fitted.contains("Bài 3: Files"));
        assertTrue(fitted.indexOf("COURSE MATERIAL CONTEXT:") < fitted.indexOf("Files store bytes"));
    }

    @Test
    void keepsTheStudentQuestionWhenTheMaterialExcerptIsTooLong() {
        String prompt = "RULES\nCOURSE MATERIAL CONTEXT:\n"
                + "A".repeat(30_000)
                + "\nSTUDENT QUESTION:\nBài 3: Files";

        String fitted = PromptTokenBudget.fit(prompt, 5_000);

        assertTrue(fitted.length() <= 5_000 * PromptTokenBudget.CHARS_PER_TOKEN);
        assertTrue(PromptTokenBudget.estimateTokens(fitted) <= 5_000);
        assertTrue(fitted.contains("STUDENT QUESTION:"));
        assertTrue(fitted.contains("Bài 3: Files"));
        assertTrue(fitted.contains("COURSE MATERIAL CONTEXT:"));
        assertTrue(fitted.length() < prompt.length());
    }

    @Test
    void detectsAnInputThatExceedsTheProviderTokenLimit() {
        String error = "Request too large for model on tokens per minute (TPM): Limit 8000, Requested 9334";

        assertTrue(PromptTokenBudget.inputExceedsReportedLimit(error));
    }

    @Test
    void ignoresAnOutputTokenLimit() {
        String error = "Request too large on output tokens per minute (OTPM): Limit 1000, Requested 2048";

        assertFalse(PromptTokenBudget.inputExceedsReportedLimit(error));
    }

    @Test
    void shrinksARejectedPromptUsingTheReportedLimitAndKeepsTheQuestion() {
        String prompt = "COURSE MATERIAL CONTEXT:\n"
                + "B".repeat(20_000)
                + "\nSTUDENT QUESTION:\nFiles";
        String error = "Request too large for model on tokens per minute (TPM): Limit 8000, Requested 9334";

        String shorter = PromptTokenBudget.shrinkToReportedLimit(prompt, error);

        assertTrue(shorter.length() < prompt.length());
        assertTrue(shorter.contains("STUDENT QUESTION:"));
        assertTrue(shorter.endsWith("Files"));
    }
}
