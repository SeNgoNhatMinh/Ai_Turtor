package com.ragapi.harness.gateway;

import com.ragapi.harness.model.RetrievedCourseChunk;

import java.util.List;

/** External semantic reranker used after hybrid retrieval. */
public interface CourseRerankGateway {

    boolean isAvailable();

    List<RetrievedCourseChunk> rerank(
            String query,
            List<RetrievedCourseChunk> candidates,
            int topK
    ) throws Exception;
}
