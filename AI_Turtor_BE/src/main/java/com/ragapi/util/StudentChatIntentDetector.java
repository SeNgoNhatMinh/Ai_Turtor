package com.ragapi.util;

import java.util.Locale;
import java.util.regex.Pattern;

/**
 * Distinguishes student chat intents for routing: greetings, off-topic policy,
 * study-start, and question-shaped academic asks. Topic names are not listed here.
 */
public final class StudentChatIntentDetector {

    private static final Pattern CLASS_TIME_QUESTION = Pattern.compile(
            "(?i)(?:\\b(?:may|maay|maays|mays|gio|giow|giowf|giw|time|when|schedule|lich)\\b.{0,30}\\b(?:hoc|class|tiet|period|session)\\b"
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

    /**
     * "Nay mình học Java Servlet" — start a topic path, not a definition dump.
     * Requires a start phrase plus "học", and must not be a definition question.
     */
    private static final Pattern TOPIC_STUDY_START = Pattern.compile(
            "(?:^|\\s)(?:nay|hom nay)(?:\\s+minh|\\s+em)?(?:\\s+muon)?\\s+hoc(?!\\s+(?:gi|cham|khong|voi)\\b)"
                    + "|(?:^|\\s)(?:minh|em)\\s+muon\\s+hoc\\b"
                    + "|(?:^|\\s)bat dau\\s+hoc\\b"
                    + "|(?:^|\\s)hoc\\s+(?:ve|phan|chuong|bai)\\b"
    );

    private static final Pattern LESSON_START = Pattern.compile(
            "bat dau\\s+bai\\s+\\d+"
                    + "|hoc ngay\\s+bai\\s+\\d+"
                    + "|(?:^|\\s)bai\\s+\\d+\\b"
                    + "|on tap\\s+phan\\b"
    );

    /**
     * Short, context-dependent turns. No course topic names — only how the student continues.
     */
    private static final Pattern DEPENDENT_FOLLOW_UP = Pattern.compile(
            "con .{0,40}thi sao"
                    + "|the con\\b"
                    + "|roi sao\\b"
                    + "|(?:co\\s+)?vi\\s+du(?:\\s+(?:ko|khong|di|nhe|voi|duoc\\s+khong|giup(?:\\s+(?:minh|em))?))?\\s*[?!.]*$"
                    + "|cho(?:\\s+mot)?\\s+vi\\s+du"
                    + "|them\\s+vi\\s+du"
                    + "|vi\\s+du\\s*[?!.]*$"
                    + "|(?:^|\\s)(?:phan do|cai do|cho do)\\b"
                    + "|(?:^|\\s)tiep(?:\\s+di|\\s+tuc)?$"
                    + "|chua hieu"
                    + "|chua ro"
                    + "|giai thich lai"
                    + "|giai thich them"
                    + "|noi ro hon"
                    + "|chi tiet hon"
                    + "|hieu roi"
                    + "|sang bai"
                    + "|bai tiep"
    );

    private static final String[] THIN_FOLLOW_UP_FILLERS = {
            "co", "ko", "khong", "di", "nhe", "voi", "minh", "em", "cho", "them", "mot",
            "cai", "do", "nay", "the", "sao", "thi", "roi", "va", "hay", "duoc", "giup",
            "ve", "phan", "nua", "ah", "uhm", "ok", "pls", "please", "nha", "hoi", "da",
            "a", "la", "gi", "cua", "nao", "nhe", "duoc", "khong"
    };

    /**
     * Question-shape markers only. Course topic names (servlet, SQL, OOP, …) must not
     * appear here — those are answered by RAG after intent is known.
     */
    private static final String[] QUESTION_SHAPE_MARKERS = {
            "la gi", "what is", "what are", "explain", "giai thich", "define", "definition",
            "khai niem", "dinh nghia", "concept",
            "khac nhau", "khac gi", "so sanh", "compare", "difference",
            "vi du", "example",
            "khi nao dung", "duoc dung khi nao", "dung de lam gi", "vai tro cua", "muc dich",
            "vong doi", "lifecycle", "gom cac", "gom nhung", "ham nao", "phuong thuc nao",
            "method nao", "hoat dong nhu the nao", "lam viec nhu the nao",
            "giup minh hieu", "giup em hieu", "hieu khai niem",
            "theo tai lieu", "trong mon", "course material", "bai giang", "chapter", "slide"
    };

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
                || isHowToUseQuestion(normalized);
    }

    public static boolean isStudyPlanningInteraction(String question) {
        return matchesStudyPlanningPhrase(normalize(question));
    }

    /**
     * Student wants to begin studying a topic and should receive a numbered lesson path
     * grounded in course materials, not a single definition dump.
     */
    public static boolean isTopicStudyStart(String question) {
        String normalized = normalize(question);
        if (normalized.isBlank() || isLessonStart(normalized) || hasDefinitionAsk(normalized)) {
            return false;
        }
        return TOPIC_STUDY_START.matcher(normalized).find();
    }

    /**
     * Student picked a numbered lesson ("Bắt đầu bài 1: …") and should be taught that lesson.
     */
    public static boolean isLessonStart(String question) {
        String normalized = normalize(question);
        if (normalized.isBlank()) {
            return false;
        }
        return LESSON_START.matcher(normalized).find();
    }

    /**
     * A turn that only makes sense with the previous lesson (e.g. "còn response thì sao?").
     * Never used to override greetings, schedule/grade policy, or an explicit new topic.
     */
    public static boolean isDependentFollowUp(String question) {
        String normalized = normalize(question);
        if (normalized.isBlank() || normalized.length() > 100) {
            return false;
        }
        if (isOffTopicNonAcademic(question)
                || isAllowedInteraction(question)
                || isTopicStudyStart(question)
                || isLessonStart(question)
                || isStudyPlanningInteraction(question)) {
            return false;
        }
        return DEPENDENT_FOLLOW_UP.matcher(normalized).find() || isThinContextAsk(normalized);
    }

    /**
     * Short asks whose only content is "example / explain that" — they need the previous
     * student question for retrieval (e.g. "có ví dụ ko?" after Servlet Specification).
     */
    private static boolean isThinContextAsk(String normalized) {
        if (normalized.length() > 80) {
            return false;
        }
        String stripped = normalized;
        for (String marker : QUESTION_SHAPE_MARKERS) {
            stripped = stripped.replace(marker, " ");
        }
        for (String filler : THIN_FOLLOW_UP_FILLERS) {
            stripped = stripped.replaceAll("(?<![\\p{L}\\p{N}])" + Pattern.quote(filler) + "(?![\\p{L}\\p{N}])", " ");
        }
        stripped = stripped.replaceAll("[^\\p{L}\\p{N}]+", " ").trim();
        if (stripped.isBlank()) {
            return true;
        }
        for (String token : stripped.split("\\s+")) {
            if (token.length() >= 3) {
                return false;
            }
        }
        return true;
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

    /**
     * True when the wording is a study question (definition, compare, how-it-works).
     * A bare topic name is not enough; that case goes to the LLM classifier / RAG fallback.
     */
    public static boolean looksLikeAcademicQuestion(String question) {
        String normalized = normalize(question);
        if (normalized.isBlank()) {
            return false;
        }
        return containsAny(normalized, QUESTION_SHAPE_MARKERS);
    }

    private static boolean isLikelyClassScheduleQuestion(String normalized) {
        boolean mentionsStudySession = containsAnyWholePhrase(
                normalized, "hoc", "class", "tiet", "session", "period");
        boolean mentionsTimeOrSchedule = containsAnyWholePhrase(
                normalized, "gio", "giow", "giowf", "giw", "may", "maay", "maays", "mays",
                "time", "when", "schedule", "lich", "lich hoc", "timetable");
        return mentionsStudySession && mentionsTimeOrSchedule;
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

    private static boolean hasDefinitionAsk(String normalized) {
        return containsAny(normalized,
                "la gi", "giai thich", "what is", "what are", "explain", "define",
                "khac nhau", "so sanh", "compare", "difference");
    }

    private static boolean matchesStudyPlanningPhrase(String normalized) {
        return containsWholePhrase(normalized, "nen hoc gi")
                || containsWholePhrase(normalized, "hoc gi tiep")
                || containsWholePhrase(normalized, "on gi")
                || containsWholePhrase(normalized, "minh yeu mon nay")
                || containsWholePhrase(normalized, "khong biet bat dau");
    }

    private static boolean containsWholePhrase(String text, String phrase) {
        return Pattern.compile(
                "(?<![\\p{L}\\p{N}])" + Pattern.quote(phrase) + "(?![\\p{L}\\p{N}])",
                Pattern.CASE_INSENSITIVE | Pattern.UNICODE_CASE
        ).matcher(text).find();
    }

    private static boolean containsAnyWholePhrase(String text, String... phrases) {
        for (String phrase : phrases) {
            if (containsWholePhrase(text, phrase)) {
                return true;
            }
        }
        return false;
    }

    private static String normalize(String question) {
        return TextSanitizer.normalizeAccentInsensitive(question == null ? "" : question.trim())
                .replace('đ', 'd')
                .replace('Đ', 'd')
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
