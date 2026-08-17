package com.ragapi.util;

import java.util.Locale;
import java.util.regex.Pattern;

/**
 * Distinguishes allowed student↔AI interactions from off-topic non-academic questions
 * that should not go through course-material RAG.
 */
public final class StudentChatIntentDetector {

    private static final Pattern CLASS_TIME_QUESTION = Pattern.compile(
            "(?i)(?:\\b(?:mai|hom nay|ngay mai|tuan nay|tuan sau|thu\\s*\\d|monday|tuesday|wednesday|thursday|friday|saturday|sunday|tomorrow|today)\\b"
                    + ".{0,30}\\b(?:hoc|class|tiet|period|session)\\b"
                    + "|\\b(?:may|maay|mays|gio|giow|giw|time|when|schedule|lich)\\b.{0,30}\\b(?:hoc|class|tiet|period|session)\\b"
                    + "|\\b(?:lich\\s*hoc|class\\s*schedule|timetable)\\b)"
    );

    private static final Pattern CLASS_LOGISTICS = Pattern.compile(
            "(?i)\\b(?:phong\\s*hoc|o\\s*dau\\s*hoc|room\\s*number|which\\s*room|co\\s*hoc\\s*khong|co\\s*di\\s*hoc|nghi\\s*hoc|cancel\\s*class|online\\s*hay\\s*offline)\\b"
    );

    private static final Pattern ADMIN_OR_PERSONAL = Pattern.compile(
            "(?i)\\b(?:diem\\s*bao\\s*nhieu|co\\s*diem\\s*chua|ket\\s*qua\\s*thi|diem\\s*cuoi\\s*ky|"
                    + "thoi\\s*tiet|an\\s*gi|xem\\s*phim|nghe\\s*nhac|bong\\s*da|"
                    + "bao\\s*nhieu\\s*tuoi|co\\s*nguoi\\s*yeu|yeu\\s*ai|dat\\s*lich\\s*hen|hen\\s*ho)\\b"
    );

    private StudentChatIntentDetector() {
    }

    public static boolean isAllowedInteraction(String question) {
        String normalized = normalize(question);
        if (normalized.isBlank() || normalized.length() > 160) {
            return false;
        }
        return isGreeting(normalized)
                || isThanks(normalized)
                || isGoodbye(normalized)
                || isCapabilityQuestion(normalized)
                || isHowToUseQuestion(normalized)
                || isStudyPlanningQuestion(normalized);
    }

    public static boolean isOffTopicNonAcademic(String question) {
        String normalized = normalize(question);
        if (normalized.isBlank() || normalized.length() > 220) {
            return false;
        }
        if (isAllowedInteraction(normalized)) {
            return false;
        }
        if (looksLikeAcademicQuestion(normalized)) {
            return false;
        }
        return CLASS_TIME_QUESTION.matcher(normalized).find()
                || CLASS_LOGISTICS.matcher(normalized).find()
                || ADMIN_OR_PERSONAL.matcher(normalized).find()
                || isLikelyClassScheduleQuestion(normalized);
    }

    public static boolean looksLikeAcademicQuestion(String normalized) {
        if (normalized == null || normalized.isBlank()) {
            return false;
        }
        return containsAny(normalized,
                "la gi", "là gì", "what is", "what are", "explain", "giai thich", "giải thích",
                "khac nhau", "khác nhau", "so sanh", "so sánh", "compare", "difference",
                "vi du", "ví dụ", "example", "define", "definition", "concept", "khai niem", "khái niệm",
                "thuat toan", "thuật toán", "algorithm", "complexity", "big o", "big-o",
                "oop", "object oriented", "class file", "interface", "inheritance", "polymorphism",
                "sql", "database", "query", "join", "index", "normalization", "jpa", "hibernate",
                "jsp", "servlet", "spring", "mvc", "rest", "api", "controller", "service",
                "thread", "process", "deadlock", "cpu", "memory", "runtime", "bytecode", "jvm",
                "scheduler", "scheduling", "operating system", "he dieu hanh", "hệ điều hành",
                "array", "linked list", "stack", "queue", "hash", "tree", "graph",
                "network", "protocol", "tcp", "udp", "http", "packet",
                "security", "xss", "csrf", "injection", "encryption",
                "debug", "bug", "exception", "stack trace", "compiler", "runtime error",
                "machine learning", "overfitting", "dataset", "model training",
                "firewire", "infiniband", "external interface", "chapter", "slide", "bai giang", "bài giảng",
                "theo tai lieu", "theo tài liệu", "trong mon", "trong môn", "course material"
        );
    }

    private static boolean isLikelyClassScheduleQuestion(String normalized) {
        boolean mentionsStudySession = containsAny(normalized, "hoc", "class", "tiet", "session", "period");
        boolean mentionsTime = containsAny(normalized, "gio", "giow", "giw", "may", "maay", "mays", "time", "when", "schedule", "lich");
        boolean mentionsDay = containsAny(normalized, "mai", "hom nay", "ngay mai", "tuan nay", "tuan sau", "thu 2", "thu 3", "thu 4", "thu 5", "thu 6", "thu 7", "tomorrow", "today");
        return mentionsStudySession && (mentionsTime || mentionsDay);
    }

    private static boolean isGreeting(String normalized) {
        return equalsAny(normalized,
                "hi", "hello", "hey", "xin chao", "chao", "chao ban", "hi ai", "hello ai");
    }

    private static boolean isThanks(String normalized) {
        return equalsAny(normalized,
                "cam on", "thank", "thanks", "thank you", "ok thanks", "cam on ban", "thanks ban");
    }

    private static boolean isGoodbye(String normalized) {
        return equalsAny(normalized, "bye", "goodbye", "tam biet");
    }

    private static boolean isCapabilityQuestion(String normalized) {
        return equalsAny(normalized,
                "ban la ai", "ban lam duoc gi", "ai tutor la gi", "help", "tro giup")
                || normalized.startsWith("ban co the giup")
                || normalized.startsWith("ban giup minh duoc khong")
                || normalized.startsWith("ban giup em duoc khong");
    }

    private static boolean isHowToUseQuestion(String normalized) {
        return normalized.contains("hoi nhu the nao")
                || normalized.contains("cach dung")
                || normalized.contains("su dung nhu the nao")
                || normalized.contains("toi nen hoi gi")
                || normalized.contains("minh nen hoi gi");
    }

    private static boolean isStudyPlanningQuestion(String normalized) {
        return normalized.contains("nen hoc gi")
                || normalized.contains("hoc gi tiep")
                || normalized.contains("on gi")
                || normalized.contains("minh yeu mon nay")
                || normalized.contains("khong biet bat dau");
    }

    private static String normalize(String question) {
        return TextSanitizer.normalizeAccentInsensitive(question == null ? "" : question.trim())
                .toLowerCase(Locale.ROOT);
    }

    private static boolean equalsAny(String value, String... candidates) {
        for (String candidate : candidates) {
            if (value.equals(candidate)) {
                return true;
            }
        }
        return false;
    }

    private static boolean containsAny(String text, String... keywords) {
        for (String keyword : keywords) {
            if (text.contains(keyword)) {
                return true;
            }
        }
        return false;
    }
}
