package com.ragapi.util;

import java.text.Normalizer;
import java.util.Locale;

/**
 * Shared heuristics for routing technical mentoring vs course RAG questions.
 */
public final class TechnicalIntentDetector {

    private static final String[] GUIDE_PHRASES = {
            "huong dan", "huong lam", "chi huong dan", "cach viet", "cach lam",
            "lam the nao", "goi y buoc", "goi y tung buoc", "goi y viet",
            "bat dau tu dau", "buoc tiep theo", "chi goi y", "chia bai toan"
    };

    private static final String[] TECH_TERMS = {
            "servlet", "jsp", "spring", "mvc", "restcontroller", "controller",
            "restful", "api", "endpoint", "frontend", "backend", "web",
            "sql", "query", "database", "jpa", "hibernate", "entity", "repository",
            "class", "interface", "method", "function", "component", "bean",
            "html", "css", "javascript", "typescript", "react", "vue", "angular",
            "flutter", "android", "ios", "docker", "kubernetes",
            "array", "linked list", "stack", "queue", "hash map", "hashmap", "tree", "graph",
            "algorithm", "thuat toan", "design pattern", "architecture", "kien truc"
    };

    private static final String[] CODE_MENTOR_KEYWORDS = {
            "loi code", "sai o dau", "debug", "bug", "exception", "stack trace", "stacktrace",
            "compiler", "compile", "runtime", "crash", "nullpointer", "403", "forbidden",
            "review code", "code review", "danh gia code", "doan code nay", "ham nay", "bien nay",
            "khong cho dap an", "dung chua", "huong cua em",
            "bo sot dieu kien", "truong hop bien", "logic dung", "loi logic",
            "big-o", "big o", "toi uu", "optimized", "optimize",
            "join", "index", "normalization", "chuan hoa",
            "cors", "request", "response",
            "solid", "module", "capstone", "do an",
            "deadlock", "process", "thread", "network", "packet", "protocol",
            "security", "bao mat", "lo hong", "vulnerability",
            "overfitting", "feature", "machine learning", "ai model"
    };

    private static final String[] GUIDE_SOLUTION_PHRASES = {
            "huong dan", "huong lam", "cach viet", "cach lam", "lam the nao",
            "bat dau tu dau", "chia bai toan", "goi y buoc", "goi y tung buoc",
            "goi y viet", "buoc tiep theo", "chi goi y", "chi huong dan"
    };

    private TechnicalIntentDetector() {
    }

    public static String normalize(String value) {
        String lower = safe(value).toLowerCase(Locale.ROOT);
        String normalized = Normalizer.normalize(lower, Normalizer.Form.NFD);
        return normalized.replaceAll("\\p{InCombiningDiacriticalMarks}+", "");
    }

    public static boolean hasText(String value) {
        return value != null && !value.isBlank();
    }

    public static boolean looksLikeGuideToCode(String text) {
        if (text == null || text.isBlank()) {
            return false;
        }
        boolean hasGuidePhrase = containsAny(text, GUIDE_PHRASES);
        boolean hasTechTerm = containsAny(text, TECH_TERMS);
        boolean asksToWriteCode = text.contains("viet") && hasTechTerm;
        return (hasGuidePhrase && hasTechTerm) || asksToWriteCode;
    }

    public static boolean containsCodeSyntax(String text) {
        return containsAny(text,
                "public class", "public static void", "system.out", " return ",
                "@restcontroller", "@service", "@entity", "repository.findbyid", "function ",
                " const ", " let ", " var ",
                "select ", "insert into", "update ", "delete from", "try {", "catch (")
                || (text.contains("{") && text.contains("}"))
                || text.contains("();");
    }

    public static boolean looksLikeCodeOrMentorGuidance(String text, String codeSnippet) {
        if (hasText(codeSnippet) || containsCodeSyntax(text)) {
            return true;
        }
        if (looksLikeGuideToCode(text)) {
            return true;
        }
        return containsAny(text, CODE_MENTOR_KEYWORDS);
    }

    public static boolean isCodeMentorQuestion(String question, String code) {
        if (hasText(code)) {
            return true;
        }
        String text = normalize(safe(question) + "\n" + safe(code));
        return looksLikeCodeOrMentorGuidance(text, code);
    }

    public static boolean looksLikeGuideSolution(String text) {
        return containsAny(text, GUIDE_SOLUTION_PHRASES) || looksLikeGuideToCode(text);
    }

    private static boolean containsAny(String text, String... keywords) {
        for (String keyword : keywords) {
            if (text.contains(keyword)) {
                return true;
            }
        }
        return false;
    }

    private static String safe(String value) {
        return value == null ? "" : value;
    }
}
