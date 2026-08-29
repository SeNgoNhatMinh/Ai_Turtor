package com.ragapi.service;

import com.ragapi.dto.IntentClassification;
import com.ragapi.dto.TutorIntentContext;
import com.ragapi.util.StudentChatIntentDetector;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.HexFormat;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.regex.Pattern;

import static com.ragapi.util.TechnicalIntentDetector.containsCodeSyntax;
import static com.ragapi.util.TechnicalIntentDetector.hasText;
import static com.ragapi.util.TechnicalIntentDetector.looksLikeCodeOrMentorGuidance;
import static com.ragapi.util.TechnicalIntentDetector.looksLikeGuideSolution;
import static com.ragapi.util.TechnicalIntentDetector.mentionsStudentCode;
import static com.ragapi.util.TechnicalIntentDetector.normalize;

@Service
@Slf4j
@RequiredArgsConstructor
public class IntentClassifierService {

    private static final long SEMANTIC_CACHE_TTL_SECONDS = 60;
    private static final int SEMANTIC_CACHE_MAX_ENTRIES = 2_000;

    public static final String MODE_RAG = "RAG";
    public static final String MODE_CODE = "CODE";
    public static final String MODE_ESCALATE = "ESCALATE";

    private final LlmIntentClassifierService llmIntentClassifierService;
    private final Map<String, CachedIntent> semanticCache = new ConcurrentHashMap<>();

    public IntentClassification classify(String message, String codeSnippet, String courseId) {
        return classify(message, codeSnippet, courseId, TutorIntentContext.none());
    }

    public IntentClassification classify(
            String message,
            String codeSnippet,
            String courseId,
            TutorIntentContext intentContext
    ) {
        TutorIntentContext context = intentContext == null ? TutorIntentContext.none() : intentContext;
        String original = safe(message) + "\n" + safe(codeSnippet);
        String text = normalize(original);
        String domain = detectDomain(text);
        if ("GENERAL_STUDY".equals(domain) && context.sessionTopic() != null && !context.sessionTopic().isBlank()) {
            domain = detectDomain(normalize(context.sessionTopic()));
        }
        final String resolvedDomain = domain;

        if (looksLikeEscalation(text)) {
            return base(MODE_ESCALATE,
                    "Teacher/mentor confirmation is required for this question",
                    0.88,
                    "TEACHER_POLICY",
                    domain,
                    "Create escalation. Do not answer from AI.",
                    false, "RULE");
        }

        if (StudentChatIntentDetector.isStudyPlanningInteraction(message)) {
            return base(MODE_RAG,
                    "Student requested a learning plan or revision direction",
                    0.95,
                    "LEARNING_PATH",
                    domain,
                    "Build a personalized learning path from course material and learner memory.",
                    true, "RULE");
        }

        if (StudentChatIntentDetector.isAllowedInteraction(message)) {
            return base(MODE_RAG,
                    "Conversational interaction with AI Tutor",
                    0.97,
                    "CONVERSATIONAL",
                    domain,
                    "Respond naturally without course-material RAG.",
                    false, "RULE");
        }

        if (StudentChatIntentDetector.isOffTopicNonAcademic(message)) {
            return base(MODE_RAG,
                    "Off-topic non-academic question",
                    0.93,
                    "OFF_TOPIC",
                    domain,
                    "Politely redirect without course-material RAG.",
                    false, "RULE");
        }

        if (StudentChatIntentDetector.isLessonStart(message)) {
            return base(MODE_RAG,
                    "Student selected a numbered lesson to study",
                    0.96,
                    "LESSON_TEACH",
                    domain,
                    "Teach this one lesson as a tutor, grounded in course material. Allow a small example when the material supports it.",
                    true, "RULE");
        }

        if (StudentChatIntentDetector.isTopicStudyStart(message)) {
            return base(MODE_RAG,
                    "Student wants to start studying a topic",
                    0.95,
                    "LEARNING_PATH",
                    domain,
                    "Propose a numbered lesson path from course material. Do not dump a full definition yet.",
                    true, "RULE");
        }

        if (context.hasTeachContext()
                && StudentChatIntentDetector.isDependentFollowUp(message)
                && !hasText(codeSnippet)
                && !containsCodeSyntax(text)
                && !mentionsStudentCode(text)) {
            return base(MODE_RAG,
                    "In-lesson follow-up; continue the current topic from chat history",
                    0.94,
                    "LESSON_TEACH",
                    domain,
                    "Teach the follow-up as a continuation of the current lesson, grounded in course material.",
                    true, "RULE");
        }

        if (hasText(codeSnippet) || containsCodeSyntax(text) || mentionsStudentCode(text)) {
            return base(MODE_CODE,
                    "Explicit code or executable syntax was provided",
                    0.98,
                    detectCodeMentorSubIntent(text, codeSnippet),
                    domain,
                    "Guide only: explain, hint, review, debug, or suggest next steps. Do not complete homework/full solutions.",
                    false, "RULE");
        }

        if (looksLikeCodeOrMentorGuidance(text, codeSnippet)) {
            return base(MODE_CODE,
                    "Explicit technical mentoring request",
                    0.90,
                    detectCodeMentorSubIntent(text, codeSnippet),
                    domain,
                    "Guide only: explain, hint, review, debug, or suggest next steps. Do not complete homework/full solutions.",
                    false, "RULE");
        }

        if (StudentChatIntentDetector.looksLikeAcademicQuestion(text)) {
            return base(MODE_RAG,
                    "Explicit academic concept or explanation request",
                    0.97,
                    detectRagSubIntent(text),
                    domain,
                    "Answer only from course material. Translate/explain naturally for Vietnamese students. Escalate if material is missing.",
                    true, "RULE");
        }

        String cacheKey = semanticCacheKey(message, codeSnippet, courseId, context.recentHistory(), context.sessionTopic());
        IntentClassification cached = getCachedSemanticIntent(cacheKey);
        if (cached != null) {
            return cached;
        }

        IntentClassification semanticIntent = llmIntentClassifierService.classify(
                        message, codeSnippet, courseId, context.recentHistory())
                .orElseGet(() -> {
                    log.info("Intent classifier using safe course-RAG fallback");
                    return base(MODE_RAG,
                            "Uncertain intent safely routed to course knowledge",
                            hasText(courseId) ? 0.72 : 0.62,
                            detectRagSubIntent(text),
                            resolvedDomain,
                            "Answer from course material and approved knowledge; escalate if evidence is insufficient.",
                            true, "SAFE_RAG_FALLBACK");
                });
        cacheSemanticIntent(cacheKey, semanticIntent);
        return semanticIntent;
    }

    private IntentClassification base(
            String mode,
            String reason,
            double confidence,
            String subIntent,
            String domain,
            String answerPolicy,
            boolean requiresCourseMaterial,
            String routingStrategy
    ) {
        return IntentClassification.builder()
                .mode(mode)
                .reason(reason)
                .confidence(confidence)
                .subIntent(subIntent)
                .domain(domain)
                .answerPolicy(answerPolicy)
                .requiresCourseMaterial(requiresCourseMaterial)
                .routingStrategy(routingStrategy)
                .build();
    }

    private boolean looksLikeEscalation(String text) {
        return containsAnyWholePhrase(text,
                "tru diem", "diem danh", "diem so", "cham diem", "grading", "grade",
                "nop tre", "late submit", "deadline", "submit sau", "assignment policy",
                "quy dinh cua thay", "quy dinh cua co", "thay co tru", "co tru diem",
                "rubric cua thay", "co duoc nop lai", "mentor phu trach", "giao vien phu trach",
                "thay co cho phep", "co co cho phep", "lich thi", "thi lai", "phuc khao");
    }


    private String detectCodeMentorSubIntent(String text, String codeSnippet) {
        if (hasText(codeSnippet) || containsAny(text, "loi code", "debug", "bug", "exception", "stack trace", "crash", "nullpointer")) {
            return "DEBUG_CODE";
        }
        if (containsAny(text, "compiler", "compile", "runtime", "loi nay", "giai thich loi")) {
            return "EXPLAIN_ERROR";
        }
        if (containsAny(text, "review code", "code review", "danh gia code", "code nay co on")) {
            return "CODE_REVIEW";
        }
        if (containsAny(text, "thuat toan", "algorithm", "big-o", "big o", "toi uu")) {
            return "ALGORITHM_HINT";
        }
        if (containsAny(text, "array", "linked list", "stack", "queue", "hash map", "hashmap", "tree", "graph", "cau truc du lieu")) {
            return "DATA_STRUCTURE_ADVICE";
        }
        if (containsAny(text, "sql", "join", "query", "database", "index", "normalization", "chuan hoa")) {
            return "SQL_REVIEW";
        }
        if (containsAny(text, "kien truc", "architecture", "solid", "design pattern", "module", "capstone", "do an")) {
            return "ARCHITECTURE_REVIEW";
        }
        if (containsAny(text, "dung chua", "huong cua em", "logic dung", "bo sot dieu kien", "truong hop bien")) {
            return "REVIEW_LOGIC";
        }
        if (looksLikeGuideSolution(text)) {
            return "GUIDE_SOLUTION";
        }
        return "TECHNICAL_MENTORING";
    }

    private String detectRagSubIntent(String text) {
        if (StudentChatIntentDetector.isLessonStart(text)) {
            return "LESSON_TEACH";
        }
        if (StudentChatIntentDetector.isTopicStudyStart(text)) {
            return "LEARNING_PATH";
        }
        if (containsAny(text, "hoi em", "dat cau hoi", "on tap", "kiem tra kien thuc", "tu de den kho")) {
            return "EXAM_PRACTICE";
        }
        if (containsAny(text, "hoc gi tiep", "nen hoc gi", "learning path", "can hoc kien thuc nao truoc", "lien quan chuong nao")) {
            return "LEARNING_PATH";
        }
        if (containsAny(text, "khac nhau", "so sanh", "difference", "compare")) {
            return "COMPARE_CONCEPTS";
        }
        if (containsAny(text, "khi nao nen", "khi nao khong", "dung de lam gi", "vi du thuc te")) {
            return "CONCEPT_APPLICATION";
        }
        return "EXPLAIN_CONCEPT";
    }

    private String detectDomain(String text) {
        if (containsAny(text, "oop", "object oriented", "class", "object", "interface", "abstract", "inheritance", "polymorphism", "encapsulation", "solid")) return "OOP";
        if (containsAny(text, "jsp", "servlet", "spring", "mvc", "rest", "api", "frontend", "backend", "web")) return "WEB";
        if (containsAny(text, "sql", "database", "join", "table", "index", "normalization", "jpa", "hibernate")) return "DATABASE";
        if (containsAny(text, "array", "linked list", "stack", "queue", "hash", "tree", "graph")) return "DATA_STRUCTURE";
        if (containsAny(text, "algorithm", "thuat toan", "big-o", "sort", "search", "dynamic programming")) return "ALGORITHM";
        if (containsAny(text, "thread", "process", "deadlock", "cpu", "memory", "os", "operating system")) return "OPERATING_SYSTEM";
        if (containsAny(text, "network", "packet", "protocol", "tcp", "udp", "http", "dns")) return "NETWORK";
        if (containsAny(text, "security", "bao mat", "vulnerability", "xss", "csrf", "sql injection")) return "SECURITY";
        if (containsAny(text, "machine learning", "overfitting", "ai model", "ml model", "feature", "dataset")) return "AI_ML";
        if (containsAny(text, "mobile", "android", "ios", "flutter", "react native")) return "MOBILE";
        return "GENERAL_STUDY";
    }

    private boolean containsAny(String text, String... keywords) {
        for (String keyword : keywords) {
            if (text.contains(keyword)) {
                return true;
            }
        }
        return false;
    }

    private boolean containsAnyWholePhrase(String text, String... phrases) {
        for (String phrase : phrases) {
            Pattern pattern = Pattern.compile(
                    "(?<![\\p{L}\\p{N}])" + Pattern.quote(phrase) + "(?![\\p{L}\\p{N}])",
                    Pattern.CASE_INSENSITIVE | Pattern.UNICODE_CASE
            );
            if (pattern.matcher(text).find()) {
                return true;
            }
        }
        return false;
    }

    private IntentClassification getCachedSemanticIntent(String key) {
        CachedIntent cached = semanticCache.get(key);
        if (cached == null) {
            return null;
        }
        if (cached.expiresAt().isBefore(Instant.now())) {
            semanticCache.remove(key, cached);
            return null;
        }
        return cached.intent();
    }

    private void cacheSemanticIntent(String key, IntentClassification intent) {
        if (semanticCache.size() >= SEMANTIC_CACHE_MAX_ENTRIES) {
            semanticCache.entrySet().removeIf(entry -> entry.getValue().expiresAt().isBefore(Instant.now()));
            if (semanticCache.size() >= SEMANTIC_CACHE_MAX_ENTRIES) {
                semanticCache.clear();
            }
        }
        semanticCache.put(key, new CachedIntent(
                intent,
                Instant.now().plusSeconds(SEMANTIC_CACHE_TTL_SECONDS)
        ));
    }

    private String semanticCacheKey(
            String message, String codeSnippet, String courseId, String recentHistory, String sessionTopic) {
        String input = safe(courseId) + "\u0000" + safe(message) + "\u0000" + safe(codeSnippet)
                + "\u0000" + safe(recentHistory) + "\u0000" + safe(sessionTopic);
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256")
                    .digest(input.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(digest);
        } catch (Exception error) {
            return Integer.toHexString(input.hashCode());
        }
    }

    private record CachedIntent(IntentClassification intent, Instant expiresAt) {
    }

    private String safe(String value) {
        return value == null ? "" : value;
    }
}