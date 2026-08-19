package com.ragapi.util;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class TechnicalIntentDetectorTest {

    @Test
    void guideToWriteServletJsp_isDetected() {
        String question = "Huong dan toi viet 1 Servlet ket hop JSP";
        String normalized = TechnicalIntentDetector.normalize(question);

        assertTrue(TechnicalIntentDetector.looksLikeGuideToCode(normalized));
        assertTrue(TechnicalIntentDetector.looksLikeCodeOrMentorGuidance(normalized, ""));
        assertTrue(TechnicalIntentDetector.isCodeMentorQuestion(question, ""));
    }

    @Test
    void servletLifecycleMethods_stayTheory() {
        String question = "Vòng đời của Servlet gồm các hàm nào (init, service, destroy)?";
        String normalized = TechnicalIntentDetector.normalize(question);

        assertTrue(TechnicalIntentDetector.looksLikeTheoryQuestion(normalized));
        assertFalse(TechnicalIntentDetector.looksLikeGuideToCode(normalized));
        assertFalse(TechnicalIntentDetector.looksLikeCodeOrMentorGuidance(normalized, ""));
        assertFalse(TechnicalIntentDetector.isCodeMentorQuestion(question, ""));
    }

    @Test
    void servletConceptQuestion_isNotGuideToCode() {
        String question = "Servlet la gi?";
        String normalized = TechnicalIntentDetector.normalize(question);

        assertFalse(TechnicalIntentDetector.looksLikeGuideToCode(normalized));
        assertFalse(TechnicalIntentDetector.looksLikeCodeOrMentorGuidance(normalized, ""));
    }

    @Test
    void servletMechanismQuestion_staysTheory() {
        String question = "Co che Servlet ket hop JSP hoat dong nhu the nao?";
        String normalized = TechnicalIntentDetector.normalize(question);

        assertFalse(TechnicalIntentDetector.looksLikeGuideToCode(normalized));
    }

    @Test
    void codeSnippet_stillRoutesToCodeMentor() {
        String question = "Code nay sai o dau?";
        String code = "public class Demo { public static void main(String[] args) { System.out.println(arr[5]); } }";

        assertTrue(TechnicalIntentDetector.isCodeMentorQuestion(question, code));
    }

    @Test
    void writeServletWithoutGuidePhrase_isDetected() {
        String question = "Viet servlet ket hop jsp";
        String normalized = TechnicalIntentDetector.normalize(question);

        assertTrue(TechnicalIntentDetector.looksLikeGuideToCode(normalized));
    }
}
