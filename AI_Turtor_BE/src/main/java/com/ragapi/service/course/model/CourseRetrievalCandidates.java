package com.ragapi.service.course.model;

import dev.langchain4j.data.embedding.Embedding;

import java.util.List;

/** Primary hybrid candidates plus the single query embedding reused by optional vector lookups. */
public record CourseRetrievalCandidates(
        List<RetrievedCourseChunk> chunks,
        Embedding queryEmbedding
) {
}
