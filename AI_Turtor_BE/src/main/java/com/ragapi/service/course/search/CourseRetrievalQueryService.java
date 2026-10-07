package com.ragapi.service.course.search;

import com.ragapi.dto.RagQueryIntent;
import com.ragapi.repository.CourseRepository;
import com.ragapi.service.RetrievalQueryTranslationService;
import com.ragapi.service.course.model.CourseRetrievalQuery;
import com.ragapi.util.LearningPathParser;
import com.ragapi.util.RagStageTimer;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;


/** Resolves and expands a user question into a retrieval query. */
@Slf4j
@Service
public class CourseRetrievalQueryService {

    private final LocalRetrievalQueryProcessor localQueryProcessor;
    private final RetrievalQueryTranslationService queryTranslationService;
    private final CourseRepository courseRepository;

    @org.springframework.beans.factory.annotation.Autowired
    public CourseRetrievalQueryService(
            LocalRetrievalQueryProcessor localQueryProcessor,
            RetrievalQueryTranslationService queryTranslationService,
            CourseRepository courseRepository
    ) {
        this.localQueryProcessor = localQueryProcessor;
        this.queryTranslationService = queryTranslationService;
        this.courseRepository = courseRepository;
    }

    public CourseRetrievalQueryService(
            LocalRetrievalQueryProcessor localQueryProcessor,
            RetrievalQueryTranslationService queryTranslationService
    ) {
        this(localQueryProcessor, queryTranslationService, null);
    }

    public CourseRetrievalQueryService(LocalRetrievalQueryProcessor localQueryProcessor) {
        this(localQueryProcessor, null, null);
    }

    public CourseRetrievalQueryService(RetrievalQueryTranslationService queryTranslationService) {
        this(new LocalRetrievalQueryProcessor(), queryTranslationService, null);
    }

    public CourseRetrievalQuery resolve(
            String question,
            String courseId,
            String retrievalHint,
            RagQueryIntent ragQueryIntent
    ) {
        long started = RagStageTimer.start();
        try {
            String focus = ragQueryIntent != null
                    && ragQueryIntent.getRetrievalQuery() != null
                    && !ragQueryIntent.getRetrievalQuery().isBlank()
                    ? ragQueryIntent.getRetrievalQuery().trim()
                    : LearningPathParser.retrievalFocus(question, retrievalHint);
            LocalRetrievalQueryProcessor.ProcessedQuery processed = localQueryProcessor.process(focus);
            String searchText = processed.semanticQuery();
            if (queryTranslationService != null && searchText != null && !searchText.isBlank()) {
                String translated = queryTranslationService.expandForRetrieval(
                        searchText,
                        courseLabel(courseId),
                        !processed.technicalTerms().isEmpty()
                );
                if (translated != null && !translated.isBlank()) {
                    searchText = translated.trim();
                }
            }
            log.info("Resolved retrieval query language={} technicalTerms={} searchChars={}",
                    processed.language(), processed.technicalTerms(), searchText == null ? 0 : searchText.length());
            return new CourseRetrievalQuery(
                    focus,
                    searchText,
                    processed.language(),
                    processed.technicalTerms(),
                    searchText
            );
        } finally {
            RagStageTimer.record("T4_QUERY_PROCESSING", started);
        }
    }

    private String courseLabel(String courseId) {
        if (courseRepository == null || courseId == null || courseId.isBlank()) {
            return courseId;
        }
        return courseRepository.findByCourseId(courseId)
                .map(course -> {
                    String name = course.getCourseName();
                    if (name == null || name.isBlank()) {
                        return courseId;
                    }
                    return courseId.trim() + " (" + name.trim() + ")";
                })
                .orElse(courseId);
    }
}
