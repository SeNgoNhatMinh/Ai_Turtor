package com.ragapi.service.course.search;

import com.ragapi.service.course.model.RetrievedCourseChunk;
import com.ragapi.service.course.gateway.CourseRerankGateway;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;

class CourseSearchResultRankingServiceTest {

    @Test
    void disabledRerankPreservesAllHybridRetrievalResultsInOrder() {
        CourseSearchResultRankingService service = new CourseSearchResultRankingService(
                mock(CourseRerankGateway.class),
                new CourseHeuristicRankingService()
        );
        ReflectionTestUtils.setField(service, "enabled", false);
        ReflectionTestUtils.setField(service, "topKAfter", 2);

        RetrievedCourseChunk unrelated = chunk(
                "Parallel applications and cluster middleware for workstation systems.",
                0.54
        );
        RetrievedCourseChunk relevant = chunk(
                "A cache hit finds data in cache. A cache miss requires access to main memory.",
                0.51
        );
        RetrievedCourseChunk partial = chunk(
                "Cache memory improves processor performance.",
                0.53
        );

        List<RetrievedCourseChunk> result = service.rerank(
                "Cache hit and cache miss definition; hit rate; miss penalty",
                List.of(unrelated, partial, relevant)
        );

        assertThat(result).containsExactly(unrelated, partial, relevant);
    }

    private RetrievedCourseChunk chunk(String content, double score) {
        return new RetrievedCourseChunk(
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
