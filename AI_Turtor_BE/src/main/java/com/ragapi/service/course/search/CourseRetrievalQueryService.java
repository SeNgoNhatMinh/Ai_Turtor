package com.ragapi.service.course.search;

import com.ragapi.dto.RagQueryIntent;
import com.ragapi.service.RetrievalQueryTranslationService;
import com.ragapi.service.course.model.CourseRetrievalQuery;
import com.ragapi.util.LearningPathParser;
import com.ragapi.util.TextSanitizer;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;

/** Resolves and expands a user question into a retrieval query. */
@Slf4j
@Service
@RequiredArgsConstructor
public class CourseRetrievalQueryService {

    private final RetrievalQueryTranslationService queryTranslation;

    public CourseRetrievalQuery resolve(
            String question,
            String courseId,
            String retrievalHint,
            RagQueryIntent ragQueryIntent
    ) {
        String focus = ragQueryIntent != null
                && ragQueryIntent.getRetrievalQuery() != null
                && !ragQueryIntent.getRetrievalQuery().isBlank()
                ? ragQueryIntent.getRetrievalQuery().trim()
                : LearningPathParser.retrievalFocus(question, retrievalHint);
        focus = augmentCrossLanguageFocus(focus);
        String expandedQuestion = queryTranslation.expandForRetrieval(focus, courseId, false);
        if (!expandedQuestion.equals(question)) {
            log.info("Expanded RAG retrieval query: {}", expandedQuestion);
        }
        return new CourseRetrievalQuery(focus, expandedQuestion);
    }

    private String augmentCrossLanguageFocus(String focus) {
        if (focus == null || focus.isBlank()) {
            return focus;
        }
        String normalized = TextSanitizer.normalizeAccentInsensitive(focus);
        LinkedHashSet<String> additions = new LinkedHashSet<>();
        if (containsAny(normalized, "con tro", "pointer", "dia chi", "địa chỉ")) {
            additions.addAll(List.of("pointer", "pointers", "memory address", "address"));
        }
        if (containsAny(normalized, "ham", "hàm", "function", "subroutine")) {
            additions.addAll(List.of("function", "functions", "subroutine"));
        }
        if (containsAny(normalized, "tham so", "tham chieu", "truyen tham so", "parameter", "argument")) {
            additions.addAll(List.of(
                    "parameter", "parameters", "argument", "pass by reference", "parameter passing"));
        }
        if (containsAny(normalized, "tra ve", "trả về", "return")) {
            additions.addAll(List.of("return", "returns", "return value"));
        }
        String lowerFocus = focus.toLowerCase(Locale.ROOT);
        additions.removeIf(term -> lowerFocus.contains(term.toLowerCase(Locale.ROOT)));
        return additions.isEmpty() ? focus : focus.trim() + " " + String.join(" ", additions);
    }

    private boolean containsAny(String value, String... needles) {
        if (value == null || value.isBlank()) {
            return false;
        }
        for (String needle : needles) {
            if (needle != null
                    && !needle.isBlank()
                    && value.contains(TextSanitizer.normalizeAccentInsensitive(needle))) {
                return true;
            }
        }
        return false;
    }
}
