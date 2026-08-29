package com.ragapi.util;

import java.text.Normalizer;
import java.util.Locale;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Shared heuristics for routing technical mentoring vs course RAG questions.
 * Pasted source and student "code" review questions go to Code Mentor; concept questions stay RAG.
 */
public final class TechnicalIntentDetector {

    private static final Pattern MARKUP_TAG = Pattern.compile(
            "<\\s*/?\\s*[a-zA-Z][\\w.-]*(?::[\\w.-]+)?"
    );
    private static final Pattern ISOLATED_CODE_WORD = Pattern.compile("(?<![a-z0-9])code(?![a-z0-9])");
    private static final Pattern CLASSIC_JSP = Pattern.compile("<%[=!@-]?");

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

    private static final String[] THEORY_QUESTION_MARKERS = {
            "la gi", "vong doi", "lifecycle", "gom cac", "gom nhung", "gom nhung gi",
            "ham nao", "phuong thuc nao", "method nao", "methods nao",
            "khai niem", "dinh nghia", "muc dich", "khac nhau", "so sanh",
            "duoc dung khi nao", "khi nao dung", "vai tro cua"
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
        if (text == null || text.isBlank()) {
            return false;
        }
        if (looksLikePastedSource(text)) {
            return true;
        }
        return containsAny(text,
                "public class", "public static void", "system.out", "out.println", " return ",
                "@restcontroller", "@service", "@entity", "repository.findbyid", "function ",
                " const ", " let ", " var ",
                "select ", "insert into", "update ", "delete from", "try {", "catch (")
                || (text.contains("{") && text.contains("}"))
                || text.contains("();");
    }

    /**
     * ChatGPT-style paste detection: a block of markup/source, not a single tag named in a concept question.
     */
    public static boolean looksLikePastedSource(String text) {
        if (text == null || text.isBlank()) {
            return false;
        }
        if (CLASSIC_JSP.matcher(text).find()) {
            return true;
        }
        if (text.contains("<!--") && countMarkupTags(text) >= 2) {
            return true;
        }
        int tags = countMarkupTags(text);
        if (tags >= 3) {
            return true;
        }
        if (tags >= 2 && (text.contains("xmlns:") || text.contains("jsp:"))) {
            return true;
        }
        return countCodeLikeLines(text) >= 3;
    }

    /**
     * Student is talking about their own snippet: "đoạn code này của em có đúng ko?"
     */
    public static boolean mentionsStudentCode(String text) {
        if (text == null || text.isBlank()) {
            return false;
        }
        if (containsAny(text,
                "doan code", "code nay", "code cua em", "code cua minh", "code em ", "code minh ",
                "code sai", "code dung", "review code", "danh gia code", "loi code",
                "ma nguon nay", "doan ma nay", "source code nay", "code cua toi")) {
            return true;
        }
        if (!ISOLATED_CODE_WORD.matcher(text).find()) {
            return false;
        }
        if (containsAny(text, "qr code", "bar code", "zip code", "postal code", "area code",
                "country code", "course code", "promo code", "coupon code", "access code")) {
            return false;
        }
        return containsAny(text,
                "dung chua", "dung ko", "dung khong", " sai", "debug", "bug", "review",
                "xuat ra", "in ra", "output", "kiem tra", "gop y", "cua em", "cua minh",
                "paste", "snippet");
    }

    public static boolean looksLikeTheoryQuestion(String text) {
        return containsAny(text, THEORY_QUESTION_MARKERS);
    }

    public static boolean looksLikeCodeOrMentorGuidance(String text, String codeSnippet) {
        if (hasText(codeSnippet) || containsCodeSyntax(text) || mentionsStudentCode(text)) {
            return true;
        }
        if (looksLikeTheoryQuestion(text) && !looksLikeGuideToCode(text)) {
            return false;
        }
        if (looksLikeGuideToCode(text)) {
            return true;
        }
        return containsAny(text, CODE_MENTOR_KEYWORDS);
    }

    private static int countMarkupTags(String text) {
        Matcher matcher = MARKUP_TAG.matcher(text);
        int count = 0;
        while (matcher.find()) {
            count++;
        }
        return count;
    }

    private static int countCodeLikeLines(String text) {
        int count = 0;
        for (String line : text.split("\\R")) {
            String trimmed = line.trim();
            if (trimmed.length() < 2) {
                continue;
            }
            if (trimmed.startsWith("<") || trimmed.startsWith("</") || trimmed.startsWith("<%")
                    || trimmed.startsWith("//") || trimmed.startsWith("/*") || trimmed.startsWith("* ")
                    || trimmed.endsWith(";") || trimmed.endsWith("{") || trimmed.endsWith("}")
                    || trimmed.contains("out.println") || trimmed.contains("();")) {
                count++;
            }
        }
        return count;
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
