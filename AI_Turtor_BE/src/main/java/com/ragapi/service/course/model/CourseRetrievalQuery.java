package com.ragapi.service.course.model;

import java.util.List;

/** Local query representation shared by vector, keyword, and lexical retrieval. */
public record CourseRetrievalQuery(
        String focus,
        String expandedQuestion,
        String language,
        List<String> technicalTerms,
        String keywordQuery
) {
    public CourseRetrievalQuery(String focus, String expandedQuestion) {
        this(focus, expandedQuestion, "en", List.of(), focus);
    }
}
