package com.ragapi.service.course.search;

import com.ragapi.util.TextSanitizer;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.regex.Pattern;

/** Local deterministic VI/EN/mixed query processing. No runtime LLM call is allowed here. */
@Service
public class LocalRetrievalQueryProcessor {
    private static final Pattern VI_DIACRITIC = Pattern.compile("[àáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđ]", Pattern.CASE_INSENSITIVE);
    private static final Pattern VI_MARKER = Pattern.compile("(?iu)(?:^|\\s)(là|gì|của|cho|với|như|thế|nào|giải|thích|không|được|hoạt|động|trong)(?:$|\\s)");
    private static final Pattern VI_ASCII_MARKER = Pattern.compile(
            "(?iu)(?<![\\p{L}\\p{N}])(la gi|giai thich|khong|duoc|hoat dong|nhu the nao|cua)(?![\\p{L}\\p{N}])");
    private static final Map<String, String> CANONICAL_TERMS = canonicalTerms();

    public ProcessedQuery process(String query) {
        String cleaned = TextSanitizer.clean(query);
        String semanticQuery = cleaned == null ? "" : cleaned.trim().replaceAll("\\s+", " ");
        String normalized = TextSanitizer.normalizeAccentInsensitive(semanticQuery).toLowerCase(Locale.ROOT);
        List<String> terms = new ArrayList<>();
        CANONICAL_TERMS.forEach((alias, canonical) -> {
            if (containsPhrase(normalized, alias) && !terms.contains(canonical)) terms.add(canonical);
        });
        boolean vietnamese = VI_DIACRITIC.matcher(semanticQuery).find()
                || VI_MARKER.matcher(semanticQuery).find()
                || VI_ASCII_MARKER.matcher(normalized).find();
        String language = vietnamese ? (terms.isEmpty() ? "vi" : "mixed") : "en";
        String keywordQuery = terms.isEmpty() ? semanticQuery : String.join(" ", terms);
        return new ProcessedQuery(semanticQuery, language, List.copyOf(terms), keywordQuery);
    }

    private boolean containsPhrase(String query, String phrase) {
        return Pattern.compile("(?<![\\p{L}\\p{N}_])" + Pattern.quote(phrase) + "(?![\\p{L}\\p{N}_])",
                Pattern.UNICODE_CHARACTER_CLASS).matcher(query).find();
    }

    private static Map<String, String> canonicalTerms() {
        LinkedHashMap<String, String> terms = new LinkedHashMap<>();
        terms.put("dependency injection", "Dependency Injection");
        terms.put("spring boot", "Spring Boot");
        terms.put("applicationcontext", "ApplicationContext");
        terms.put("application context", "ApplicationContext");
        terms.put("inversion of control", "IoC");
        terms.put("ioc", "IoC");
        terms.put("jpa", "JPA");
        terms.put("bean", "Bean");
        terms.put("thread", "Thread");
        terms.put("pointer", "Pointer");
        terms.put("con tro", "Pointer");
        terms.put("function", "Function");
        terms.put("ham", "Function");
        terms.put("parameter", "Parameter");
        terms.put("tham so", "Parameter");
        terms.put("return", "Return");
        terms.put("tra ve", "Return");
        return Collections.unmodifiableMap(terms);
    }

    public record ProcessedQuery(String semanticQuery, String language, List<String> technicalTerms, String keywordQuery) {}
}
