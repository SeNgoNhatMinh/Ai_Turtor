package com.ragapi.service.course.search;

import com.ragapi.service.course.model.RetrievedCourseChunk;
import com.ragapi.service.course.gateway.CourseKnowledgeSearchGateway;
import com.ragapi.service.*;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class ApprovedKnowledgeSearchServiceTest {

    @Test
    void keepsStrongSemanticApprovedKnowledgeWithoutKeywordOverlap() throws Exception {
        CourseKnowledgeSearchGateway vectorService = mock(CourseKnowledgeSearchGateway.class);
        ApprovedKnowledgeSearchService service = service(vectorService);
        var chunk = chunk("Nội dung đã được Senior duyệt", 0.90);
        when(vectorService.searchApprovedKnowledgeWithScores("question", "PRJ301", null, 8))
                .thenReturn(List.of(chunk));

        assertThat(service.retrieveRelevant("question", "PRJ301", null)).containsExactly(chunk);
    }

    @Test
    void rejectsWeakAndUnrelatedApprovedKnowledge() throws Exception {
        CourseKnowledgeSearchGateway vectorService = mock(CourseKnowledgeSearchGateway.class);
        ApprovedKnowledgeSearchService service = service(vectorService);
        when(vectorService.searchApprovedKnowledgeWithScores("Servlet lifecycle", "PRJ301", null, 8))
                .thenReturn(List.of(chunk("Database transaction isolation", 0.61)));

        assertThat(service.retrieveRelevant("Servlet lifecycle", "PRJ301", null)).isEmpty();
    }

    @Test
    void keepsNearExactIndexedQuestionEvenWhenAnswerIsLongAndScoreIsModerate() throws Exception {
        CourseKnowledgeSearchGateway vectorService = mock(CourseKnowledgeSearchGateway.class);
        ApprovedKnowledgeSearchService service = service(vectorService);
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

    @Test
    void keepsConciseQuestionWhenApprovedQuestionAddsAnotherClause() throws Exception {
        CourseKnowledgeSearchGateway vectorService = mock(CourseKnowledgeSearchGateway.class);
        ApprovedKnowledgeSearchService service = service(vectorService);
        String chunkContent = """
                [KIẾN THỨC BỔ SUNG ĐÃ ĐƯỢC SENIOR DUYỆT]
                Câu hỏi: pytorch là gì ? nó được dùng để làm gì ?
                Câu trả lời: PyTorch là thư viện tính toán khoa học dựa trên Python.
                """.trim();
        var chunk = chunk(chunkContent, 0.55);
        when(vectorService.searchApprovedKnowledgeWithScores(
                "pytorch là gì ?", "PFP191", null, 8))
                .thenReturn(List.of(chunk));

        assertThat(service.retrieveRelevant("pytorch là gì ?", "PFP191", null))
                .containsExactly(chunk);
    }

    @Test
    void retrievesConceptMentionedDeepInsideApprovedAnswer() throws Exception {
        CourseKnowledgeSearchGateway vectorService = mock(CourseKnowledgeSearchGateway.class);
        CourseMaterialTextSearchService fallback = mock(CourseMaterialTextSearchService.class);
        ApprovedKnowledgeSearchService service = service(vectorService, fallback);
        String chunkContent = """
                [KIẾN THỨC BỔ SUNG ĐÃ ĐƯỢC SENIOR DUYỆT]
                Câu hỏi: pytorch là gì và được dùng để làm gì?
                Câu trả lời: PyTorch hỗ trợ xây dựng mạng neural.
                Phần nền tảng giải thích tensors, weights và biases.
                Forward Propagation là bước đưa dữ liệu qua mạng để tạo dự đoán.
                """.trim();
        var chunk = chunk(chunkContent, 0.90);
        when(vectorService.searchApprovedKnowledgeWithScores(
                "Forward Propagation", "PFP191", null, 8))
                .thenReturn(List.of());
        when(fallback.searchApprovedKnowledge(
                "Forward Propagation", "PFP191", null, 8))
                .thenReturn(List.of(chunk));

        assertThat(service.retrieveRelevant("Forward Propagation", "PFP191", null))
                .containsExactly(chunk);
    }

    private ApprovedKnowledgeSearchService service(CourseKnowledgeSearchGateway vectorService) {
        CourseMaterialTextSearchService fallback = mock(CourseMaterialTextSearchService.class);
        return service(vectorService, fallback);
    }

    private ApprovedKnowledgeSearchService service(
            CourseKnowledgeSearchGateway vectorService,
            CourseMaterialTextSearchService fallback
    ) {
        ApprovedKnowledgeSearchService service = new ApprovedKnowledgeSearchService(vectorService, fallback);
        ReflectionTestUtils.setField(service, "maxChunks", 2);
        ReflectionTestUtils.setField(service, "minScore", 0.60);
        ReflectionTestUtils.setField(service, "strongSemanticScore", 0.82);
        ReflectionTestUtils.setField(service, "minKeywordOverlap", 0.12);
        return service;
    }

    private RetrievedCourseChunk chunk(String content, double score) {
        return new RetrievedCourseChunk(
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
