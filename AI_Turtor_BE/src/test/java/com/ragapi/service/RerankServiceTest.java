package com.ragapi.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;

class RerankServiceTest {

    @Test
    void disabledRerankPreservesAllHybridRetrievalResultsInOrder() {
        RerankService service = new RerankService(
                new ObjectMapper(),
                mock(PrivacySanitizer.class)
        );
        ReflectionTestUtils.setField(service, "enabled", false);
        ReflectionTestUtils.setField(service, "topKAfter", 2);

        ElasticVectorService.SearchChunk unrelated = chunk(
                "Parallel applications and cluster middleware for workstation systems.",
                0.54
        );
        ElasticVectorService.SearchChunk relevant = chunk(
                "A cache hit finds data in cache. A cache miss requires access to main memory.",
                0.51
        );
        ElasticVectorService.SearchChunk partial = chunk(
                "Cache memory improves processor performance.",
                0.53
        );

        List<ElasticVectorService.SearchChunk> result = service.rerank(
                "Cache hit and cache miss definition; hit rate; miss penalty",
                List.of(unrelated, partial, relevant)
        );

        assertThat(result).containsExactly(unrelated, partial, relevant);
    }

    private ElasticVectorService.SearchChunk chunk(String content, double score) {
        return new ElasticVectorService.SearchChunk(
                content,
                score,
                "material-1",
                "CEA201",
                null,
                "teacher-1",
                "COURSE_SHARED",
                "PDF"
        );
    }
}
