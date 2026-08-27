package com.ragapi.service;

import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class ApprovedKnowledgeRetrievalServiceTest {

    @Test
    void keepsStrongSemanticApprovedKnowledgeWithoutKeywordOverlap() throws Exception {
        ElasticVectorService vectorService = mock(ElasticVectorService.class);
        ApprovedKnowledgeRetrievalService service = service(vectorService);
        var chunk = chunk("Nội dung đã được Senior duyệt", 0.90);
        when(vectorService.searchApprovedKnowledgeWithScores("question", "PRJ301", null, 8))
                .thenReturn(List.of(chunk));

        assertThat(service.retrieveRelevant("question", "PRJ301", null)).containsExactly(chunk);
    }

    @Test
    void rejectsWeakAndUnrelatedApprovedKnowledge() throws Exception {
        ElasticVectorService vectorService = mock(ElasticVectorService.class);
        ApprovedKnowledgeRetrievalService service = service(vectorService);
        when(vectorService.searchApprovedKnowledgeWithScores("Servlet lifecycle", "PRJ301", null, 8))
                .thenReturn(List.of(chunk("Database transaction isolation", 0.61)));

        assertThat(service.retrieveRelevant("Servlet lifecycle", "PRJ301", null)).isEmpty();
    }

    @Test
    void keepsNearExactIndexedQuestionEvenWhenAnswerIsLongAndScoreIsModerate() throws Exception {
        ElasticVectorService vectorService = mock(ElasticVectorService.class);
        ApprovedKnowledgeRetrievalService service = service(vectorService);
        String chunkContent = """
                [KIẾN THỨC BỔ SUNG ĐÃ ĐƯỢC SENIOR DUYỆT]
                Câu hỏi: pytorch được áp dụng trong python như thế nào ?
                Câu trả lời: PyTorch là thư viện Python dùng tensor để tính toán số và huấn luyện mô hình AI.
                Cài đặt bằng pip install torch, sau đó import torch, tạo torch.tensor và dùng torch.nn để dựng mạng.
                Thư viện này cũng hỗ trợ GPU, autograd, DataLoader, optimizer và nhiều API khác không xuất hiện trong giáo trình vòng lặp.
                """.trim();
        var chunk = chunk(chunkContent, 0.64);
        when(vectorService.searchApprovedKnowledgeWithScores(
                "pytorch được áp dụng ở trong python như thế nào ?", "PFP191", null, 8))
                .thenReturn(List.of(chunk));

        assertThat(service.retrieveRelevant(
                "pytorch được áp dụng ở trong python như thế nào ?", "PFP191", null))
                .containsExactly(chunk);
    }

    private ApprovedKnowledgeRetrievalService service(ElasticVectorService vectorService) {
        ApprovedKnowledgeRetrievalService service = new ApprovedKnowledgeRetrievalService(vectorService);
        ReflectionTestUtils.setField(service, "maxChunks", 2);
        ReflectionTestUtils.setField(service, "minScore", 0.60);
        ReflectionTestUtils.setField(service, "strongSemanticScore", 0.82);
        ReflectionTestUtils.setField(service, "minKeywordOverlap", 0.12);
        return service;
    }

    private ElasticVectorService.SearchChunk chunk(String content, double score) {
        return new ElasticVectorService.SearchChunk(
                content,
                score,
                "approved-material",
                "PRJ301",
                null,
                "senior-1",
                "COURSE_SHARED"
        );
    }
}
