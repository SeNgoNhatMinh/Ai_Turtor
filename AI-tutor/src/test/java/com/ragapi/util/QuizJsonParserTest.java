package com.ragapi.util;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

class QuizJsonParserTest {

    private final ObjectMapper mapper = new ObjectMapper();

    record QuizPayload(List<QuizQuestion> questions) {}

    record QuizQuestion(
            String type,
            String questionText,
            List<String> options,
            String correctAnswer,
            String explanation
    ) {}

    @Test
    void repairsMissingCommaBetweenTypeAndNextField() throws Exception {
        String broken = """
                {
                  "questions": [
                    {
                      "type": "MULTIPLE_CHOICE"
                      "questionText": "OOP là gì?",
                      "options": ["A", "B", "C", "D"],
                      "correctAnswer": "A",
                      "explanation": "Test"
                    }
                  ]
                }
                """;
        String repaired = QuizJsonParser.repairJson(broken);
        assertTrue(repaired.contains("\"MULTIPLE_CHOICE\", \"questionText\""));
    }

    @Test
    void repairsDoubleQuoteTypoBeforeNextKey() {
        String broken = """
                {
                  "questions": [
                    {
                      "type": "MULTIPLE_CHOICE""questionText": "OOP?",
                      "options": ["A", "B"],
                      "correctAnswer": "A",
                      "explanation": "ok"
                    }
                  ]
                }
                """;
        String repaired = QuizJsonParser.repairJson(broken);
        assertTrue(repaired.contains("\"MULTIPLE_CHOICE\", \"questionText\""));
    }

    @Test
    void lenientReadValueRecoversFromMalformedQuestionFive() throws Exception {
        String broken = """
                {
                  "questions": [
                    {
                      "type": "MULTIPLE_CHOICE",
                      "questionText": "Q1",
                      "options": ["A", "B", "C", "D"],
                      "correctAnswer": "A",
                      "explanation": "e1"
                    },
                    {
                      "type": "MULTIPLE_CHOICE""questionText": "Q5",
                      "options": ["A", "B", "C", "D"],
                      "correctAnswer": "B",
                      "explanation": "e5"
                    }
                  ]
                }
                """;
        QuizPayload payload = QuizJsonParser.readValue(broken, mapper, QuizPayload.class);
        assertNotNull(payload.questions());
        assertFalse(payload.questions().isEmpty());
    }
}
