package com.ragapi.service;

import com.ragapi.dto.CourseRagAnswer;
import com.ragapi.dto.cotraining.*;
import com.ragapi.entity.*;
import com.ragapi.repository.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ExpertCoTrainingServiceTest {
    @Mock ExpertTaskRepository tasks;
    @Mock GoldQaRepository gold;
    @Mock ExpertRubricRepository rubrics;
    @Mock CoverageGapRepository gaps;
    @Mock EvalRunRepository runs;
    @Mock EvalResultRepository results;
    @Mock CourseMaterialRepository materials;
    @Mock ChapterOutlineService chapterOutlines;
    @Mock ElasticVectorService vectors;
    @Mock CourseRagService rag;
    @Mock RealtimeEventService realtimeEvents;
    ExpertCoTrainingService service;

    @BeforeEach
    void setUp() {
        service = new ExpertCoTrainingService(tasks, gold, rubrics, gaps, runs, results, materials, chapterOutlines, vectors, rag, realtimeEvents);
    }

    @Test
    void evaluationGoldIsHoldoutAndNeverIndexedOnApproval() throws Exception {
        GoldQa item = GoldQa.builder().id("G1").courseId("PRJ301").chapter("JSP").question("JSP là gì?")
                .goldAnswer("JSP là công nghệ view phía máy chủ.").usage("EVALUATION").holdout(true)
                .status("PENDING_REVIEW").authorId("T1").build();
        when(gold.findById("G1")).thenReturn(Optional.of(item));
        when(gold.save(any())).thenAnswer(inv -> inv.getArgument(0));
        ExpertReviewRequest review = new ExpertReviewRequest();
        review.setReviewerId("S1"); review.setReviewerRole("SENIOR_MENTOR");

        GoldQa approved = service.reviewGoldQa("G1", review, true);

        assertEquals("APPROVED", approved.getStatus());
        assertNull(approved.getIndexedAt());
        verifyNoInteractions(vectors);
    }

    @Test
    void trainingGoldIsIndexedOnlyAfterSeniorApproval() throws Exception {
        GoldQa item = GoldQa.builder().id("G2").courseId("PRJ301").chapter("JSP").question("JSP lifecycle?")
                .goldAnswer("Translation, compilation, init, service, destroy.").usage("TRAINING").holdout(false)
                .status("PENDING_REVIEW").authorId("T1").build();
        when(gold.findById("G2")).thenReturn(Optional.of(item));
        when(gold.save(any())).thenAnswer(inv -> inv.getArgument(0));
        ExpertReviewRequest review = new ExpertReviewRequest();
        review.setReviewerId("S1"); review.setReviewerRole("SENIOR_MENTOR");

        GoldQa approved = service.reviewGoldQa("G2", review, true);

        assertEquals("INDEXED", approved.getStatus());
        assertNotNull(approved.getIndexedAt());
        verify(vectors).indexChunk(eq("PRJ301"), isNull(), eq("T1"), eq("G2"), eq("COURSE_SHARED"), eq("GOLD_QA"), isNull(), isNull(), contains("JSP lifecycle"));
    }

    @Test
    void coverageAnalysisWithNoMaterialReportsGapWithoutCreatingGoldTasks() {
        when(materials.findByCourseId("PRJ301")).thenReturn(List.of());
        when(chapterOutlines.findOutlineByTitle("PRJ301", "JSP")).thenReturn(null);
        when(chapterOutlines.materialHealth(null, 0)).thenReturn("NO_MATERIAL");
        when(gold.findByCourseIdAndChapterAndUsage(anyString(), anyString(), anyString())).thenReturn(List.of());
        when(gaps.findFirstByCourseIdAndChapterAndStatusInOrderByDetectedAtDesc(anyString(), anyString(), anyList())).thenReturn(Optional.empty());
        when(gaps.save(any())).thenAnswer(inv -> { CoverageGap g = inv.getArgument(0); if (g.getId() == null) g.setId("GAP1"); return g; });
        CoverageAnalysisRequest request = new CoverageAnalysisRequest();
        request.setCourseId("PRJ301");
        request.setChapters(List.of("JSP"));
        request.setCreateTasks(true);
        request.setRequestedBy("ADMIN");
        request.setSmartTaskPolicy(true);

        List<CoverageGap> found = service.analyzeCoverage(request);

        assertEquals(1, found.size());
        assertEquals("CRITICAL", found.get(0).getSeverity());
        assertEquals("OPEN", found.get(0).getStatus());
        assertEquals("NO_MATERIAL", found.get(0).getMaterialHealth());
        verify(tasks, never()).save(any(ExpertTask.class));
    }

    @Test
    void coverageAnalysisCreatesGoldTasksWhenMaterialOkAndExplicitlyRequested() {
        CourseChapterOutline outline = CourseChapterOutline.builder()
                .courseId("PRJ301").title("JSP").chunkCount(5).approxChars(2000L).build();
        CourseMaterial indexed = new CourseMaterial();
        indexed.setIndexingStatus("INDEXED");
        when(materials.findByCourseId("PRJ301")).thenReturn(List.of(indexed));
        when(chapterOutlines.findOutlineByTitle("PRJ301", "JSP")).thenReturn(outline);
        when(chapterOutlines.materialHealth(outline, 1)).thenReturn("MATERIAL_OK");
        when(gold.findByCourseIdAndChapterAndUsage(anyString(), anyString(), anyString())).thenReturn(List.of());
        when(gaps.findFirstByCourseIdAndChapterAndStatusInOrderByDetectedAtDesc(anyString(), anyString(), anyList())).thenReturn(Optional.empty());
        when(gaps.save(any())).thenAnswer(inv -> { CoverageGap g = inv.getArgument(0); if (g.getId() == null) g.setId("GAP1"); return g; });
        when(tasks.save(any())).thenAnswer(inv -> inv.getArgument(0));
        CoverageAnalysisRequest request = new CoverageAnalysisRequest();
        request.setCourseId("PRJ301");
        request.setChapters(List.of("JSP"));
        request.setCreateTasks(true);
        request.setRequestedBy("ADMIN");
        request.setSmartTaskPolicy(true);
        request.setIncludeTrainingGoldTasks(true);
        request.setIncludeBenchmarkTasks(true);
        request.setMinimumTrainingGoldPerChapter(1);
        request.setMinimumEvaluationGoldPerChapter(1);

        List<CoverageGap> found = service.analyzeCoverage(request);

        assertEquals(1, found.size());
        assertEquals("TASK_CREATED", found.get(0).getStatus());
        verify(tasks, times(2)).save(any(ExpertTask.class));
    }

    @Test
    void evalRunUsesApprovedHoldoutAndProducesMetrics() throws Exception {
        GoldQa item = GoldQa.builder().id("E1").courseId("PRJ301").chapter("Spring Boot")
                .question("Spring Boot là gì?").goldAnswer("Spring Boot hỗ trợ auto configuration và starter dependencies.")
                .usage("EVALUATION").holdout(true).status("APPROVED").build();
        when(gold.findByCourseIdAndUsageAndStatus("PRJ301", "EVALUATION", "APPROVED")).thenReturn(List.of(item));
        when(runs.findFirstByCourseIdAndStatusOrderByCompletedAtDesc("PRJ301", "PASSED")).thenReturn(Optional.empty());
        when(runs.save(any())).thenAnswer(inv -> { EvalRun r = inv.getArgument(0); if (r.getId() == null) r.setId("RUN1"); return r; });
        when(rag.askWithConfidence(anyString(), eq("PRJ301"), isNull())).thenReturn(CourseRagAnswer.builder()
                .answer("Spring Boot hỗ trợ auto configuration và starter dependencies.").confidence(0.9)
                .escalationRecommended(false).sources(List.of("demo")).build());
        StartEvalRunRequest request = new StartEvalRunRequest(); request.setCourseId("PRJ301"); request.setPassThreshold(0.6);

        EvalRun run = service.runEvaluation(request);

        assertEquals("PASSED", run.getStatus()); assertEquals(1, run.getPassedCases()); assertEquals(0.0, run.getHallucinationRate());
        verify(results).saveAll(anyList());
    }

    @Test
    void rubricWeightsMustSumToOne() {
        SubmitRubricRequest request = new SubmitRubricRequest(); request.setCourseId("PRJ301"); request.setChapter("JSP");
        request.setName("Default"); request.setAuthorId("T1"); request.setCriteriaWeights(Map.of("accuracy", 0.5, "grounded", 0.2));
        assertThrows(IllegalArgumentException.class, () -> service.submitRubric(request));
    }

    @Test
    void createTaskRejectsPastDueAt() {
        CreateExpertTaskRequest request = new CreateExpertTaskRequest();
        request.setCourseId("PRJ301");
        request.setChapter("JSP");
        request.setType("GOLD_QA");
        request.setTitle("Test task");
        request.setDueAt(java.time.LocalDateTime.now().minusDays(1));
        assertThrows(IllegalArgumentException.class, () -> service.createTask(request));
        verify(tasks, never()).save(any());
    }

    @Test
    void createChapterTasksRequiresConfirmedIndexedChapter() {
        CourseChapterOutline suggested = CourseChapterOutline.builder()
                .courseId("PRJ301").title("JSP").status("SUGGESTED").chunkCount(5).build();
        when(chapterOutlines.findOutlineByTitle("PRJ301", "JSP")).thenReturn(suggested);
        CreateChapterTasksRequest request = new CreateChapterTasksRequest();
        request.setCourseId("PRJ301");
        request.setChapter("JSP");

        IllegalArgumentException error = assertThrows(
                IllegalArgumentException.class,
                () -> service.createChapterTasks(request));

        assertEquals("Chapter must be confirmed before creating tasks", error.getMessage());
        verify(tasks, never()).save(any());
    }

    @Test
    void createChapterTasksUsesCanonicalConfirmedChapter() {
        CourseChapterOutline confirmed = CourseChapterOutline.builder()
                .courseId("PRJ301").title("Java Server Pages").status("CONFIRMED").chunkCount(5).build();
        when(chapterOutlines.findOutlineByTitle("PRJ301", "JSP")).thenReturn(confirmed);
        when(gaps.findFirstByCourseIdAndChapterAndStatusInOrderByDetectedAtDesc(
                eq("PRJ301"), eq("Java Server Pages"), anyList())).thenReturn(Optional.empty());
        when(tasks.save(any())).thenAnswer(invocation -> invocation.getArgument(0));
        CreateChapterTasksRequest request = new CreateChapterTasksRequest();
        request.setCourseId("PRJ301");
        request.setChapter("JSP");
        request.setIncludeTrainingGoldTask(true);
        request.setIncludeEvaluationGoldTask(false);

        List<ExpertTask> created = service.createChapterTasks(request);

        assertEquals(1, created.size());
        assertEquals("Java Server Pages", created.get(0).getChapter());
    }
}
