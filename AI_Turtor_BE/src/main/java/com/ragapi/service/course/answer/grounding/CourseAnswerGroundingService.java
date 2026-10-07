package com.ragapi.service.course.answer.grounding;

import com.ragapi.service.course.model.CourseGroundingAssessment;
import com.ragapi.service.course.model.RetrievedCourseChunk;
import com.ragapi.util.TextSanitizer;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Service
public class CourseAnswerGroundingService {

    private static final Pattern CODE_IDENTIFIER = Pattern.compile(
            "(?iu)(?<![\\p{L}\\p{N}_])([a-z_][a-z0-9_]{3,})(?![\\p{L}\\p{N}_])"
    );
    private static final double MIN_GROUNDED_CONFIDENCE = 0.6;
    private static final Set<String> STOP_WORDS = Set.of(
            "la", "gi", "gì", "cua", "của", "cho", "em", "anh", "chi", "chị",
            "the", "thế", "nao", "nào", "hay", "giai", "giải", "thich", "thích",
            "explain", "what", "is", "a", "an", "and", "or", "in", "on",
            "of", "to", "with", "about", "please", "help",
            "toi", "minh", "muon", "hoc", "cach", "tao", "hom", "nay", "ban",
            "bai", "ngay", "mot", "giup", "noi", "voi", "trong", "khi", "lam",
            "duoc", "khong", "can", "biet", "hieu"
    );

    public CourseGroundingAssessment assess(
            String question,
            String retrievalQuestion,
            String context,
            List<RetrievedCourseChunk> chunks,
            boolean hasLessonPreviewContext
    ) {
        double confidence = calculateConfidence(chunks);
        boolean grounded = hasGroundedContext(question, context)
                || hasGroundedContext(retrievalQuestion, context)
                || hasLessonPreviewContext;
        boolean hasApprovedKnowledge = chunks != null && chunks.stream().anyMatch(chunk ->
                "KNOWLEDGE_CANDIDATE".equalsIgnoreCase(chunk.sourceType())
                        || (chunk.content() != null && chunk.content().contains("KIẾN THỨC BỔ SUNG")));
        if (hasApprovedKnowledge) {
            grounded = true;
        }

        confidence = adjustConfidence(
                retrievalQuestion,
                context,
                chunks,
                confidence,
                grounded
        );
        if (hasLessonPreviewContext) {
            confidence = Math.max(confidence, MIN_GROUNDED_CONFIDENCE + 0.10);
        }
        if (hasApprovedKnowledge) {
            confidence = Math.max(confidence, MIN_GROUNDED_CONFIDENCE + 0.05);
        }
        return new CourseGroundingAssessment(confidence, grounded, hasApprovedKnowledge);
    }

    private double calculateConfidence(List<RetrievedCourseChunk> chunks) {
        if (chunks == null || chunks.isEmpty()) {
            return 0.0;
        }
        double averageScore = chunks.stream()
                .map(RetrievedCourseChunk::score)
                .filter(score -> score != null && !score.isNaN())
                .mapToDouble(Double::doubleValue)
                .average()
                .orElse(0.0);
        double sourceCoverage = Math.min(0.25, chunks.size() * 0.05);
        double scoreConfidence = averageScore <= 0 ? 0.25 : Math.min(0.55, averageScore / 2.0);
        return Math.min(0.95, 0.20 + sourceCoverage + scoreConfidence);
    }

    private double adjustConfidence(
            String question,
            String context,
            List<RetrievedCourseChunk> chunks,
            double currentConfidence,
            boolean grounded
    ) {
        if (!grounded || chunks == null || chunks.isEmpty()) {
            return currentConfidence;
        }
        String normalizedQuestion = normalize(question);
        String normalizedContext = normalize(context);
        boolean conceptSupported = hasCrossLanguageConceptSupport(normalizedQuestion, normalizedContext);
        long matchedTokens = significantTokens(question).stream()
                .filter(normalizedContext::contains)
                .count();
        if (conceptSupported || matchedTokens >= 1) {
            return Math.max(currentConfidence, MIN_GROUNDED_CONFIDENCE + 0.08);
        }
        if (chunks.size() >= 3 && context != null && context.length() >= 250) {
            return Math.max(currentConfidence, MIN_GROUNDED_CONFIDENCE + 0.02);
        }
        return currentConfidence;
    }

    private boolean hasGroundedContext(String question, String context) {
        if (context == null || context.isBlank()) {
            return false;
        }
        String normalizedQuestion = normalize(question);
        String normalizedContext = normalize(context);
        if (hasCrossLanguageConceptSupport(normalizedQuestion, normalizedContext)
                || hasMethodCallSupport(question, context)) {
            return true;
        }
        List<String> tokens = significantTokens(question);
        if (tokens.isEmpty()) {
            return false;
        }
        long matchedTokens = tokens.stream().filter(normalizedContext::contains).count();
        return matchedTokens >= Math.min(2, tokens.size());
    }

    private boolean hasMethodCallSupport(String question, String context) {
        String evidence = context == null ? "" : context.toLowerCase(Locale.ROOT);
        Matcher matcher = CODE_IDENTIFIER.matcher(question == null ? "" : question.toLowerCase(Locale.ROOT));
        while (matcher.find()) {
            String identifier = matcher.group(1);
            if (STOP_WORDS.contains(identifier)) {
                continue;
            }
            if (evidence.contains("." + identifier + "(") || evidence.contains(identifier + "(")) {
                return true;
            }
        }
        return false;
    }

    private boolean hasCrossLanguageConceptSupport(String question, String context) {
        if (question == null || context == null) {
            return false;
        }
        if ((question.contains("oop") || question.contains("object oriented"))
                && (context.contains("oop") || context.contains("object oriented"))) {
            return true;
        }
        if ((question.contains("jvm") || question.contains("may ao java"))
                && context.contains("java virtual machine")) {
            return true;
        }
        if ((question.contains("bytecode") || question.contains("ma byte"))
                && context.contains("bytecode")) {
            return true;
        }
        if ((question.contains("class file") || question.contains("file class"))
                && context.contains("class file")) {
            return true;
        }
        if ((question.contains("runtime data") || question.contains("vung du lieu runtime"))
                && context.contains("runtime data")) {
            return true;
        }
        if ((question.contains("virtual machine") || question.contains("may ao"))
                && context.contains("virtual machine")) {
            return true;
        }
        if ((question.contains("con tro") || question.contains("pointer"))
                && (context.contains("pointer") || context.contains("memory address")
                || context.contains("address"))) {
            return true;
        }
        if ((question.contains("tham so") || question.contains("parameter")
                || question.contains("argument") || question.contains("truyen tham so"))
                && (context.contains("parameter") || context.contains("argument")
                || context.contains("pass by reference") || context.contains("parameter passing"))) {
            return true;
        }
        return (question.contains("ham") || question.contains("function") || question.contains("subroutine"))
                && (context.contains("function") || context.contains("subroutine"));
    }

    private List<String> significantTokens(String text) {
        String normalized = normalize(text);
        List<String> tokens = new ArrayList<>();
        for (String raw : normalized.split("\\s+")) {
            String token = raw.trim();
            if (token.length() >= 3 && !STOP_WORDS.contains(token) && !tokens.contains(token)) {
                tokens.add(token);
            }
        }
        return tokens;
    }

    private String normalize(String value) {
        return TextSanitizer.normalizeAccentInsensitive(value);
    }
}
