package com.ragapi.service;

import com.ragapi.dto.CourseRagAnswer;
import com.ragapi.dto.RagQueryIntent;
import com.ragapi.entity.CourseMaterial;
import com.ragapi.repository.CourseMaterialRepository;
import com.ragapi.repository.CourseRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class CourseRagServiceTextbookTest {

    @Mock ElasticVectorService vectorService;
    @Mock CourseMaterialFallbackSearchService fallbackSearchService;
    @Mock RerankService rerankService;
    @Mock OpenRouterChatService chatService;
    @Mock RetrievalQueryTranslationService retrievalQueryTranslationService;
    @Mock CourseMaterialRepository materialRepository;
    @Mock CourseRepository courseRepository;
    @Mock CanonicalTutorAnswerCacheService answerCacheService;
    @Mock TutorCacheHitAuditService cacheHitAuditService;
    @Mock RagContextBudgetService contextBudgetService;
    @Mock ApprovedKnowledgeRetrievalService approvedKnowledgeRetrievalService;
    @Mock ChapterOutlineService chapterOutlineService;
    @Mock PdfEvidenceLocatorService pdfEvidenceLocatorService;
    private final ParentChildRetrievalService parentChildRetrievalService =
            new ParentChildRetrievalService(new CourseMaterialChunkingService());

    private CourseRagService service;

    @BeforeEach
    void setUp() {
        service = new CourseRagService(
                vectorService,
                fallbackSearchService,
                rerankService,
                chatService,
                retrievalQueryTranslationService,
                materialRepository,
                courseRepository,
                answerCacheService,
                cacheHitAuditService,
                contextBudgetService,
                approvedKnowledgeRetrievalService,
                parentChildRetrievalService,
                new CourseMaterialChunkingService(),
                chapterOutlineService,
                pdfEvidenceLocatorService
        );
    }

    @Test
    void textbookExamSkipsCacheAndLearnedKnowledge() throws Exception {
        ElasticVectorService.SearchChunk textbookChunk = new ElasticVectorService.SearchChunk(
                "PRO la he dieu hanh thoi gian thuc dung trong giao trinh.",
                0.95,
                "material-1",
                "PRJ301",
                null,
                "teacher-1",
                "COURSE_SHARED"
        );
        when(retrievalQueryTranslationService.expandForRetrieval(anyString(), eq("PRJ301"), any(Boolean.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));
        when(vectorService.searchTextbookWithScores(anyString(), eq("PRJ301"), isNull()))
                .thenReturn(List.of(textbookChunk));
        when(rerankService.rerank(anyString(), any())).thenAnswer(invocation -> invocation.getArgument(1));
        when(contextBudgetService.applyBudget(any())).thenAnswer(invocation -> invocation.getArgument(0));
        when(materialRepository.findAllById(any())).thenReturn(List.of());
        when(courseRepository.findByCourseId("PRJ301")).thenReturn(Optional.empty());
        when(chatService.generate(anyString(), eq("PRO la gi?")))
                .thenReturn("Theo giao trinh, PRO la he dieu hanh thoi gian thuc.");

        CourseRagAnswer answer = service.askWithConfidenceFromTextbook("PRO la gi?", "PRJ301", null);

        assertEquals("Theo giao trinh, PRO la he dieu hanh thoi gian thuc.", answer.getAnswer());
        assertFalse(answer.getEscalationRecommended());
        verify(vectorService).searchTextbookWithScores(anyString(), eq("PRJ301"), isNull());
        verify(vectorService, never()).searchWithScores(anyString(), anyString(), any());
        verifyNoInteractions(answerCacheService, cacheHitAuditService, approvedKnowledgeRetrievalService);
        verify(fallbackSearchService, never()).search(anyString(), anyString(), any(), any(Integer.class));
    }

    @Test
    void generatedInsufficientMaterialAnswerDoesNotKeepRetrievalConfidenceOrEvidence() throws Exception {
        ElasticVectorService.SearchChunk textbookChunk = new ElasticVectorService.SearchChunk(
                "So sánh hai phương pháp dùng dictionary: get và if/in.",
                0.95,
                "material-1",
                "PFP191",
                null,
                "teacher-1",
                "COURSE_SHARED"
        );
        when(retrievalQueryTranslationService.expandForRetrieval(anyString(), eq("PFP191"), any(Boolean.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));
        when(vectorService.searchTextbookWithScores(anyString(), eq("PFP191"), isNull()))
                .thenReturn(List.of(textbookChunk));
        when(rerankService.rerank(anyString(), any())).thenAnswer(invocation -> invocation.getArgument(1));
        when(contextBudgetService.applyBudget(any())).thenAnswer(invocation -> invocation.getArgument(0));
        when(materialRepository.findAllById(any())).thenReturn(List.of());
        when(chatService.generate(anyString(), eq("So sánh hai phương pháp")))
                .thenReturn("Material không đủ để trả lời câu hỏi.");

        CourseRagAnswer answer = service.askWithConfidenceFromTextbook(
                "So sánh hai phương pháp", "PFP191", null);

        assertEquals(0.0, answer.getConfidence());
        assertEquals("NONE", answer.getGroundingType());
        assertTrue(answer.getSources().isEmpty());
        assertTrue(answer.getSourceEvidence().isEmpty());
        assertTrue(answer.getEscalationRecommended());
        assertTrue(answer.getAnswer().contains("chưa đủ nội dung"));
    }

    @Test
    void studentAskRetrievesTextbooksFirstAndNeverUsesUnfilteredSearch() throws Exception {
        ElasticVectorService.SearchChunk textbookChunk = new ElasticVectorService.SearchChunk(
                "Java EE builds on Java SE and adds enterprise APIs.",
                0.91,
                "pdf-1",
                "PRJ301",
                null,
                "teacher-1",
                "COURSE_SHARED",
                "PDF"
        );
        when(retrievalQueryTranslationService.expandForRetrieval(anyString(), eq("PRJ301"), any(Boolean.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));
        when(vectorService.searchTextbookWithScores(anyString(), eq("PRJ301"), isNull()))
                .thenReturn(List.of(textbookChunk));
        when(vectorService.searchGoldQaTeachingNotesWithScores(anyString(), eq("PRJ301"), isNull(), eq(2)))
                .thenReturn(List.of());
        when(approvedKnowledgeRetrievalService.retrieveRelevant(anyString(), eq("PRJ301"), isNull()))
                .thenReturn(List.of());
        when(rerankService.rerank(anyString(), any())).thenAnswer(invocation -> invocation.getArgument(1));
        when(contextBudgetService.applyBudget(any())).thenAnswer(invocation -> invocation.getArgument(0));
        when(materialRepository.findAllById(any())).thenReturn(List.of());
        when(answerCacheService.lookupExactRagAnswer(eq("PRJ301"), isNull(), anyString())).thenReturn(Optional.empty());
        when(answerCacheService.lookupEarlySemanticRagAnswer(eq("PRJ301"), isNull(), anyString())).thenReturn(Optional.empty());
        when(answerCacheService.lookupSemanticRagAnswer(eq("PRJ301"), isNull(), anyString(), any(Double.class), any()))
                .thenReturn(Optional.empty());
        when(chatService.generate(anyString(), eq("Java EE vs Java SE")))
                .thenReturn("Theo giao trinh, Java EE xay tren Java SE.");

        CourseRagAnswer answer = service.askWithConfidence("Java EE vs Java SE", "PRJ301", null);

        assertEquals("Theo giao trinh, Java EE xay tren Java SE.", answer.getAnswer());
        verify(vectorService).searchTextbookWithScores(anyString(), eq("PRJ301"), isNull());
        verify(vectorService).searchGoldQaTeachingNotesWithScores(anyString(), eq("PRJ301"), isNull(), eq(2));
        verify(vectorService, never()).searchWithScores(anyString(), anyString(), any());
    }

    @Test
    void studentAskKeepsMultipleDistinctChunksFromTheSamePdf() throws Exception {
        ElasticVectorService.SearchChunk definitionChunk = new ElasticVectorService.SearchChunk(
                "A cache hit occurs when requested data is found in cache memory.",
                0.94,
                "cea-textbook",
                "CEA201",
                null,
                "teacher-1",
                "COURSE_SHARED",
                "PDF"
        );
        ElasticVectorService.SearchChunk missChunk = new ElasticVectorService.SearchChunk(
                "A cache miss requires fetching the requested block from main memory.",
                0.92,
                "cea-textbook",
                "CEA201",
                null,
                "teacher-1",
                "COURSE_SHARED",
                "PDF"
        );
        when(retrievalQueryTranslationService.expandForRetrieval(anyString(), eq("CEA201"), any(Boolean.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));
        when(vectorService.searchTextbookWithScores(anyString(), eq("CEA201"), isNull()))
                .thenReturn(List.of(definitionChunk, missChunk));
        when(vectorService.searchGoldQaTeachingNotesWithScores(anyString(), eq("CEA201"), isNull(), eq(2)))
                .thenReturn(List.of());
        when(approvedKnowledgeRetrievalService.retrieveRelevant(anyString(), eq("CEA201"), isNull()))
                .thenReturn(List.of());
        when(rerankService.rerank(anyString(), any())).thenAnswer(invocation -> invocation.getArgument(1));
        when(contextBudgetService.applyBudget(any())).thenAnswer(invocation -> invocation.getArgument(0));
        when(materialRepository.findAllById(any())).thenReturn(List.of());
        when(courseRepository.findByCourseId("CEA201")).thenReturn(Optional.empty());
        when(answerCacheService.lookupExactRagAnswer(eq("CEA201"), isNull(), anyString())).thenReturn(Optional.empty());
        when(answerCacheService.lookupEarlySemanticRagAnswer(eq("CEA201"), isNull(), anyString())).thenReturn(Optional.empty());
        when(answerCacheService.lookupSemanticRagAnswer(eq("CEA201"), isNull(), anyString(), any(Double.class), any()))
                .thenReturn(Optional.empty());
        when(chatService.generate(anyString(), eq("Cache hit và cache miss là gì?")))
                .thenReturn("Cache hit tìm thấy dữ liệu trong cache; cache miss phải đọc từ bộ nhớ chính.");

        service.askWithConfidence("Cache hit và cache miss là gì?", "CEA201", null);

        ArgumentCaptor<String> promptCaptor = ArgumentCaptor.forClass(String.class);
        verify(chatService).generate(promptCaptor.capture(), eq("Cache hit và cache miss là gì?"));
        assertTrue(promptCaptor.getValue().contains(definitionChunk.content()));
        assertTrue(promptCaptor.getValue().contains(missChunk.content()));
    }

    @Test
    void blocksNamedFunctionWhenRetrievedMaterialDoesNotMentionIt() throws Exception {
        String question = "Sử dụng isinstance() để kiểm tra kiểu dữ liệu";
        ElasticVectorService.SearchChunk typeChunk = new ElasticVectorService.SearchChunk(
                "Python has int, float and str values. The type() function returns a value's type.",
                0.95,
                "python-textbook",
                "PFP191",
                null,
                "teacher-1",
                "COURSE_SHARED",
                "PDF"
        );
        when(retrievalQueryTranslationService.expandForRetrieval(anyString(), eq("PFP191"), eq(false)))
                .thenAnswer(invocation -> invocation.getArgument(0));
        when(vectorService.searchTextbookWithScores(anyString(), eq("PFP191"), isNull()))
                .thenReturn(List.of(typeChunk));
        when(vectorService.searchGoldQaTeachingNotesWithScores(anyString(), eq("PFP191"), isNull(), eq(2)))
                .thenReturn(List.of());
        when(approvedKnowledgeRetrievalService.retrieveRelevant(anyString(), eq("PFP191"), isNull()))
                .thenReturn(List.of());
        when(rerankService.rerank(anyString(), any())).thenAnswer(invocation -> invocation.getArgument(1));
        when(contextBudgetService.applyBudget(any())).thenAnswer(invocation -> invocation.getArgument(0));
        when(materialRepository.findAllById(any())).thenReturn(List.of());

        CourseRagAnswer answer = service.askWithConfidence(question, "PFP191", null);

        assertTrue(answer.getEscalationRecommended());
        assertTrue(answer.getAnswer().contains("isinstance()"));
        verifyNoInteractions(chatService);
    }

    @Test
    void hybridRetrievalKeepsExactLexicalEvidenceWhenVectorCandidateIsOffTopic() throws Exception {
        String question = "What is write-through allocation?";
        ElasticVectorService.SearchChunk vectorChunk = new ElasticVectorService.SearchChunk(
                "Parallel applications use cluster middleware.",
                0.91,
                "textbook",
                "CEA201",
                null,
                "teacher-1",
                "COURSE_SHARED",
                "PDF"
        );
        ElasticVectorService.SearchChunk lexicalChunk = new ElasticVectorService.SearchChunk(
                "Write-through is a cache policy that updates main memory on every cache write.",
                0.82,
                "textbook",
                "CEA201",
                null,
                "teacher-1",
                "COURSE_SHARED",
                "PDF"
        );
        when(retrievalQueryTranslationService.expandForRetrieval(eq(question), eq("CEA201"), eq(false)))
                .thenReturn(question);
        when(vectorService.searchTextbookWithScores(question, "CEA201", null))
                .thenReturn(List.of(vectorChunk));
        when(fallbackSearchService.searchTextbook(question, "CEA201", null, 8))
                .thenReturn(List.of(lexicalChunk));
        when(vectorService.searchGoldQaTeachingNotesWithScores(question, "CEA201", null, 2))
                .thenReturn(List.of());
        when(approvedKnowledgeRetrievalService.retrieveRelevant(question, "CEA201", null))
                .thenReturn(List.of());
        when(rerankService.rerank(eq(question), any())).thenAnswer(invocation -> invocation.getArgument(1));
        when(contextBudgetService.applyBudget(any())).thenAnswer(invocation -> invocation.getArgument(0));
        CourseMaterial material = new CourseMaterial();
        material.setId("textbook");
        material.setTitle("Computer Architecture");
        material.setCourseId("CEA201");
        material.setSourceType("PDF");
        material.setContent(vectorChunk.content() + "\n\n" + lexicalChunk.content());
        when(materialRepository.findAllById(any())).thenReturn(List.of(material));
        when(courseRepository.findByCourseId("CEA201")).thenReturn(Optional.empty());
        when(answerCacheService.lookupExactRagAnswer("CEA201", null, question)).thenReturn(Optional.empty());
        when(answerCacheService.lookupEarlySemanticRagAnswer("CEA201", null, question)).thenReturn(Optional.empty());
        when(answerCacheService.lookupSemanticRagAnswer(eq("CEA201"), isNull(), eq(question), any(Double.class), any()))
                .thenReturn(Optional.empty());
        when(chatService.generate(anyString(), eq(question)))
                .thenReturn("Write-through updates cache and main memory on each write.");
        when(pdfEvidenceLocatorService.locate(eq(material), contains("Write-through")))
                .thenReturn(new PdfEvidenceLocatorService.PageLocation(42, 42));

        CourseRagAnswer answer = service.askWithConfidence(question, "CEA201", null);

        ArgumentCaptor<String> promptCaptor = ArgumentCaptor.forClass(String.class);
        verify(chatService).generate(promptCaptor.capture(), eq(question));
        assertTrue(promptCaptor.getValue().contains(lexicalChunk.content()));
        assertEquals(1, answer.getSourceEvidence().size());
        assertTrue(answer.getSourceEvidence().get(0).getExcerpt().contains("Write-through"));
        assertFalse(answer.getSourceEvidence().get(0).getExcerpt().contains("cluster middleware"));
        assertEquals(42, answer.getSourceEvidence().get(0).getPageStart());
        assertFalse(answer.getSourceEvidence().get(0).getPageEstimated());
    }

    @Test
    void exampleFollowUpRetrievesPreviousQuestionNotBareExampleQuery() throws Exception {
        String followUp = "có ví dụ ko?";
        String previous = "Servlet Specification giúp mình hiểu khái niệm của phần này với?";
        String retrievalFocus = previous + " " + followUp;
        ElasticVectorService.SearchChunk specChunk = new ElasticVectorService.SearchChunk(
                "The Servlet Specification defines servlet lifecycle methods init, service, destroy.",
                0.71,
                "spec",
                "PRJ301",
                null,
                "teacher-1",
                "COURSE_SHARED",
                "PDF"
        );
        ElasticVectorService.SearchChunk jspxChunk = new ElasticVectorService.SearchChunk(
                "JSP Document (JSPX) is an XML JSP file. Example: <jsp:directive.page />",
                0.93,
                "jspx",
                "PRJ301",
                null,
                "teacher-1",
                "COURSE_SHARED",
                "PDF"
        );
        when(retrievalQueryTranslationService.expandForRetrieval(eq(retrievalFocus), eq("PRJ301"), eq(false)))
                .thenReturn(retrievalFocus);
        when(vectorService.searchTextbookWithScores(eq(retrievalFocus), eq("PRJ301"), isNull()))
                .thenReturn(List.of(jspxChunk, specChunk));
        when(fallbackSearchService.searchTextbook(eq(retrievalFocus), eq("PRJ301"), isNull(), eq(8)))
                .thenReturn(List.of(specChunk));
        when(vectorService.searchGoldQaTeachingNotesWithScores(eq(retrievalFocus), eq("PRJ301"), isNull(), eq(2)))
                .thenReturn(List.of());
        when(approvedKnowledgeRetrievalService.retrieveRelevant(eq(retrievalFocus), eq("PRJ301"), isNull()))
                .thenReturn(List.of());
        when(rerankService.rerank(eq(retrievalFocus), any())).thenAnswer(invocation -> invocation.getArgument(1));
        when(contextBudgetService.applyBudget(any())).thenAnswer(invocation -> invocation.getArgument(0));
        when(chatService.generate(anyString(), eq(followUp)))
                .thenReturn("Servlet Specification quy định init, service, destroy.");

        CourseRagAnswer answer = service.askWithConfidence(followUp, "PRJ301", null, "EXPLAIN_CONCEPT", previous);

        assertEquals("Servlet Specification quy định init, service, destroy.", answer.getAnswer());
        ArgumentCaptor<String> promptCaptor = ArgumentCaptor.forClass(String.class);
        verify(chatService).generate(promptCaptor.capture(), eq(followUp));
        assertTrue(promptCaptor.getValue().contains(specChunk.content()));
        verify(vectorService).searchTextbookWithScores(eq(retrievalFocus), eq("PRJ301"), isNull());
        verify(fallbackSearchService).searchTextbook(eq(retrievalFocus), eq("PRJ301"), isNull(), eq(8));
        verifyNoInteractions(answerCacheService, cacheHitAuditService);
    }

    @Test
    void sourceBackedStudyTipPinsTheOriginalBrontosaurusChunk() throws Exception {
        String question = "Ôn tập phần \"Đọc lại ví dụ brontosaurus để thấy lợi ích của get\"";
        CourseMaterial material = new CourseMaterial();
        material.setId("pythonlearn");
        material.setTitle("Main Material VN");
        material.setCourseId("PFP191");
        material.setMaterialScope("COURSE_SHARED");
        material.setSourceType("PDF");
        material.setContent("""
                CHAPTER 1 INTRODUCTION
                This opening chapter explains how programs are executed and contains unrelated material.

                CHAPTER 9 DICTIONARIES
                Dictionaries have a method called get that takes a key and a default value.
                We can use get to write the histogram loop more concisely.
                word = 'brontosaurus'
                d = dict()
                for c in word:
                    d[c] = d.get(c, 0) + 1
                print(d)
                The get method handles a missing key by returning the supplied default value.
                """);
        CourseMaterialChunkingService chunker = new CourseMaterialChunkingService();
        String sourceChunkId = chunker.chunkHierarchically(material).stream()
                .filter(chunk -> chunk.content().contains("brontosaurus"))
                .findFirst()
                .orElseThrow()
                .chunkId();
        RagQueryIntent sourceIntent = RagQueryIntent.builder()
                .learningObjective("brontosaurus get")
                .retrievalQuery("brontosaurus get")
                .retrievalTerms(List.of("brontosaurus", "get"))
                .teachingMode("EXPLAIN_CONCEPT")
                .sourceMaterialIds(List.of("pythonlearn"))
                .sourceChunkIds(List.of(sourceChunkId))
                .sourceTerms(List.of("brontosaurus", "get"))
                .build();

        when(retrievalQueryTranslationService.expandForRetrieval("brontosaurus get", "PFP191", false))
                .thenReturn("brontosaurus get");
        when(vectorService.searchTextbookWithScores("brontosaurus get", "PFP191", null))
                .thenReturn(List.of());
        when(vectorService.searchTextbookKeywordWithScores("brontosaurus get", "PFP191", null, 12))
                .thenReturn(List.of());
        when(fallbackSearchService.searchTextbook("brontosaurus get", "PFP191", null, 8))
                .thenReturn(List.of());
        when(vectorService.searchGoldQaTeachingNotesWithScores("brontosaurus get", "PFP191", null, 2))
                .thenReturn(List.of());
        when(approvedKnowledgeRetrievalService.retrieveRelevant("brontosaurus get", "PFP191", null))
                .thenReturn(List.of());
        when(materialRepository.findAllById(any())).thenReturn(List.of(material));
        when(rerankService.rerank(eq("brontosaurus get"), any()))
                .thenAnswer(invocation -> invocation.getArgument(1));
        when(contextBudgetService.applyBudget(any())).thenAnswer(invocation -> invocation.getArgument(0));
        when(courseRepository.findByCourseId("PFP191")).thenReturn(Optional.empty());
        when(chatService.generate(anyString(), eq(question)))
                .thenReturn("get(key, 0) trả về 0 khi ký tự chưa có trong từ điển.");

        CourseRagAnswer answer = service.askWithImprovePlanContext(
                question, "PFP191", null, "", "", sourceIntent);

        ArgumentCaptor<String> promptCaptor = ArgumentCaptor.forClass(String.class);
        verify(chatService).generate(promptCaptor.capture(), eq(question));
        assertTrue(promptCaptor.getValue().contains("word = 'brontosaurus'"));
        assertTrue(promptCaptor.getValue().contains("d.get(c, 0) + 1"));
        assertTrue(answer.getSourceEvidence().stream()
                .anyMatch(evidence -> sourceChunkId.equals(evidence.getChunkId())));
        verifyNoInteractions(answerCacheService, cacheHitAuditService);
    }
}
