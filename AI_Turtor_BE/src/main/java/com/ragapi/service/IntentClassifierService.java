package com.ragapi.service;

import com.ragapi.dto.IntentClassification;
import com.ragapi.util.StudentChatIntentDetector;
import org.springframework.stereotype.Service;

import static com.ragapi.util.TechnicalIntentDetector.containsCodeSyntax;
import static com.ragapi.util.TechnicalIntentDetector.hasText;
import static com.ragapi.util.TechnicalIntentDetector.looksLikeCodeOrMentorGuidance;
import static com.ragapi.util.TechnicalIntentDetector.looksLikeGuideSolution;
import static com.ragapi.util.TechnicalIntentDetector.normalize;

@Service
public class IntentClassifierService {

    public static final String MODE_RAG = "RAG";
    public static final String MODE_CODE = "CODE";
    public static final String MODE_ESCALATE = "ESCALATE";

    public IntentClassification classify(String message, String codeSnippet, String courseId) {
        String original = safe(message) + "\n" + safe(codeSnippet);
        String text = normalize(original);
        String domain = detectDomain(text);

        if (looksLikeEscalation(text)) {
            return base(MODE_ESCALATE,
                    "Teacher/mentor confirmation is required for this question",
                    0.88,
                    "TEACHER_POLICY",
                    domain,
                    "Create escalation. Do not answer from AI.",
                    false);
        }

        if (StudentChatIntentDetector.isAllowedInteraction(message)) {
            return base(MODE_RAG,
                    "Conversational interaction with AI Tutor",
                    0.97,
                    "CONVERSATIONAL",
                    domain,
                    "Respond naturally without course-material RAG.",
                    false);
        }

        if (StudentChatIntentDetector.isOffTopicNonAcademic(message)) {
            return base(MODE_RAG,
                    "Off-topic non-academic question",
                    0.93,
                    "OFF_TOPIC",
                    domain,
                    "Politely redirect without course-material RAG.",
                    false);
        }

        if (looksLikeCodeOrMentorGuidance(text, codeSnippet)) {
            return base(MODE_CODE,
                    "Interactive technical mentoring request",
                    hasText(codeSnippet) || containsCodeSyntax(text) ? 0.95 : 0.86,
                    detectCodeMentorSubIntent(text, codeSnippet),
                    domain,
                    "Guide only: explain, hint, review, debug, or suggest next steps. Do not complete homework/full solutions.",
                    false);
        }

        String subIntent = detectRagSubIntent(text);
        return base(MODE_RAG,
                "Theory or course material question",
                hasText(courseId) ? 0.92 : 0.78,
                subIntent,
                domain,
                "Answer only from course material. Translate/explain naturally for Vietnamese students. Escalate if material is missing.",
                true);
    }

    private IntentClassification base(
            String mode,
            String reason,
            double confidence,
            String subIntent,
            String domain,
            String answerPolicy,
            boolean requiresCourseMaterial
    ) {
        return IntentClassification.builder()
                .mode(mode)
                .reason(reason)
                .confidence(confidence)
                .subIntent(subIntent)
                .domain(domain)
                .answerPolicy(answerPolicy)
                .requiresCourseMaterial(requiresCourseMaterial)
                .build();
    }

    private boolean looksLikeEscalation(String text) {
        return containsAny(text,
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

    private String safe(String value) {
        return value == null ? "" : value;
    }
}