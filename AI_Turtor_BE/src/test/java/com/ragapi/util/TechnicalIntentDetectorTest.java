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
    void pastedJspxWithOutputAsk_isCodeNotTheory() {
        String question = """
                code này đúng chưa và nó xuất ra màn hình là gì ?
                <jsp:root xmlns:jsp="http://java.sun.com/JSP/Page" version="2.0">
                <jsp:directive.page language="java" contentType="text/html; charset=UTF-8"/>
                <jsp:scriptlet>counter++;</jsp:scriptlet>
                </jsp:root>
                """;
        String normalized = TechnicalIntentDetector.normalize(question);

        assertTrue(TechnicalIntentDetector.containsCodeSyntax(normalized));
        assertTrue(TechnicalIntentDetector.isCodeMentorQuestion(question, ""));
    }

    @Test
    void wrappedJspxTagsAcrossLines_isStillPastedSource() {
        String question = """
                code này đúng chưa và nó xuất ra màn hình là gì ?
                <
                jsp:root xmlns:jsp="http://java.sun.com/JSP/Page" version="2.0">
                <jsp:scriptlet>counter++;</jsp:scriptlet>
                </jsp:root>
                """;
        String normalized = TechnicalIntentDetector.normalize(question);

        assertTrue(TechnicalIntentDetector.looksLikePastedSource(normalized));
        assertTrue(TechnicalIntentDetector.containsCodeSyntax(normalized));
        assertTrue(TechnicalIntentDetector.isCodeMentorQuestion(question, ""));
    }

    @Test
    void htmlPasteIsCodeNotTheory() {
        String question = """
                đoạn này đúng chưa?
                <html><head><title>hi</title></head><body><p>hello</p></body></html>
                """;
        assertTrue(TechnicalIntentDetector.containsCodeSyntax(TechnicalIntentDetector.normalize(question)));
        assertTrue(TechnicalIntentDetector.isCodeMentorQuestion(question, ""));
    }

    @Test
    void singleTagInConceptQuestion_isNotPastedSource() {
        String question = "Thẻ <jsp:include> dùng khi nào?";
        String normalized = TechnicalIntentDetector.normalize(question);

        assertFalse(TechnicalIntentDetector.looksLikePastedSource(normalized));
        assertFalse(TechnicalIntentDetector.containsCodeSyntax(normalized));
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
    void doanCodeNayCuaEm_isCodeMentorEvenWithoutPaste() {
        String question = "đoạn code này của em có đúng ko?";
        String normalized = TechnicalIntentDetector.normalize(question);

        assertTrue(TechnicalIntentDetector.mentionsStudentCode(normalized));
        assertTrue(TechnicalIntentDetector.isCodeMentorQuestion(question, ""));
    }

    @Test
    void qrCodeQuestion_isNotStudentCode() {
        String normalized = TechnicalIntentDetector.normalize("QR code là gì?");

        assertFalse(TechnicalIntentDetector.mentionsStudentCode(normalized));
        assertFalse(TechnicalIntentDetector.isCodeMentorQuestion("QR code là gì?", ""));
    }

    @Test
    void writeServletWithoutGuidePhrase_isDetected() {
        String question = "Viet servlet ket hop jsp";
        String normalized = TechnicalIntentDetector.normalize(question);

        assertTrue(TechnicalIntentDetector.looksLikeGuideToCode(normalized));
    }
}
