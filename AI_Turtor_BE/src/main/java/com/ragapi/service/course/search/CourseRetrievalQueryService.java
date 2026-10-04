package com.ragapi.service.course.search;

import com.ragapi.dto.RagQueryIntent;
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

    @org.springframework.beans.factory.annotation.Autowired
    public CourseRetrievalQueryService(LocalRetrievalQueryProcessor localQueryProcessor) {
        this.localQueryProcessor = localQueryProcessor;
    }

    /** Backward-compatible test constructor; runtime translation is intentionally ignored. */
    public CourseRetrievalQueryService(RetrievalQueryTranslationService ignored) {
        this(new LocalRetrievalQueryProcessor());
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
            log.info("Resolved local retrieval query language={} technicalTerms={}",
                    processed.language(), processed.technicalTerms());
            return new CourseRetrievalQuery(
                    focus,
                    processed.semanticQuery(),
                    processed.language(),
                    processed.technicalTerms(),
                    processed.keywordQuery()
            );
        } finally {
            RagStageTimer.record("T4_QUERY_PROCESSING", started);
        }
    }
}
