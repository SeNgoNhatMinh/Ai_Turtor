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
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Query;

import java.time.LocalDateTime;
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
    @Mock CanonicalTutorAnswerCacheService answerCache;
    @Mock RealtimeEventService realtimeEvents;
    @Mock MongoTemplate mongoTemplate;
    ExpertCoTrainingService service;

    @BeforeEach
    void setUp() {
        service = new ExpertCoTrainingService(
                tasks,
                gold,
                rubrics,
                gaps,
                runs,
                results,
                materials,
                chapterOutlines,
                vectors,
                rag,
                answerCache,
                realtimeEvents,
                mongoTemplate
        );
    }

    @Test
    void evaluationHoldoutIsApprovedWithoutIndexingIntoRag() throws Exception {
        GoldQa item = GoldQa.builder().id("G1").courseId("PRJ301").chapter("JSP").question("JSP là gì?")
                .goldAnswer("JSP là công nghệ view phía máy chủ.").usage("EVALUATION").holdout(true)
                .status("PENDING_REVIEW").authorId("T1").build();
        when(gold.findById("G1")).thenReturn(Optional.of(item));
        when(gold.save(any())).thenAnswer(inv -> inv.getArgument(0));
        ExpertReviewRequest review = new ExpertReviewRequest();
        review.setReviewerId("S1"); review.setReviewerRole("SENIOR_MENTOR");

        GoldQa approved = service.reviewGoldQa("G1", review, true);

        assertEquals("APPROVED", approved.getStatus());
        assertTrue(Boolean.TRUE.equals(approved.getHoldout()));
        assertNull(approved.getIndexedAt());
        verify(vectors, never()).indexChunk(any(), any(), any(), any(), any(), any(), any(), any(), any());
        verify(answerCache, never()).evictRagAnswersForCourse(anyString());
    }

    @Test
    void trainingGoldIsIndexedOnlyAfterSeniorApproval() throws Exception {
        GoldQa item = GoldQa.builder().id("G2").courseId("PRJ301").chapter("JSP").question("JSP lifecycle?")
                .goldAnswer("Teacher guidance: mention every lifecycle phase.")
                .examAiAnswer("AI final answer: translation, compilation, init, service, destroy.")
                .examUsedTeachingNote(true).usage("TRAINING").holdout(false)
                .status("PENDING_REVIEW").authorId("T1").build();
        when(gold.findById("G2")).thenReturn(Optional.of(item));
        when(gold.save(any())).thenAnswer(inv -> inv.getArgument(0));
        ExpertReviewRequest review = new ExpertReviewRequest();
        review.setReviewerId("S1"); review.setReviewerRole("SENIOR_MENTOR");

        GoldQa approved = service.reviewGoldQa("G2", review, true);

        assertEquals("INDEXED", approved.getStatus());
        assertNotNull(approved.getIndexedAt());
        assertEquals("AI final answer: translation, compilation, init, service, destroy.",
                approved.getApprovedAnswer());
        verify(vectors).indexChunk(eq("PRJ301"), isNull(), eq("T1"), eq("G2"), eq("COURSE_SHARED"), eq("GOLD_QA"), isNull(), isNull(),
                argThat(content -> content != null
                        && content.contains("JSP lifecycle")
                        && content.contains("AI final answer: translation, compilation, init, service, destroy.")
                        && !content.contains("Teacher guidance: mention every lifecycle phase.")));
        verify(answerCache).evictRagAnswersForCourse("PRJ301");
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
    void startChapterOpensGoldTasksForSuggestedIndexedChapter() {
        CourseChapterOutline suggested = CourseChapterOutline.builder()
                .courseId("PRJ301").title("JSP").status("SUGGESTED").chunkCount(5).build();
        when(chapterOutlines.findOutlineByTitle("PRJ301", "JSP")).thenReturn(suggested);
        when(tasks.findByCourseIdAndChapterOrderByCreatedAtDesc("PRJ301", "JSP")).thenReturn(List.of());
        when(tasks.save(any())).thenAnswer(invocation -> invocation.getArgument(0));
        CreateChapterTasksRequest request = new CreateChapterTasksRequest();
        request.setCourseId("PRJ301");
        request.setChapter("JSP");

        List<ExpertTask> created = service.startChapter(request);

        assertEquals(2, created.size());
        assertTrue(created.get(0).getTitle().contains("Q&A vàng"));
        verify(tasks, times(2)).save(any(ExpertTask.class));
    }

    @Test
    void startChapterReusesActiveTasksInsteadOfDuplicating() {
        CourseChapterOutline outline = CourseChapterOutline.builder()
                .courseId("PRJ301").title("JSP").status("SUGGESTED").chunkCount(5).build();
        ExpertTask existing = ExpertTask.builder().id("T1").type("GOLD_QA").status("OPEN").chapter("JSP").build();
        when(chapterOutlines.findOutlineByTitle("PRJ301", "JSP")).thenReturn(outline);
        when(tasks.findByCourseIdAndChapterOrderByCreatedAtDesc("PRJ301", "JSP")).thenReturn(List.of(existing));
        CreateChapterTasksRequest request = new CreateChapterTasksRequest();
        request.setCourseId("PRJ301");
        request.setChapter("JSP");

        List<ExpertTask> result = service.startChapter(request);

        assertEquals(1, result.size());
        verify(tasks, never()).save(any());
    }

    @Test
    void startChapterUsesCanonicalChapterTitle() {
        CourseChapterOutline confirmed = CourseChapterOutline.builder()
                .courseId("PRJ301").title("Java Server Pages").status("CONFIRMED").chunkCount(5).build();
        when(chapterOutlines.findOutlineByTitle("PRJ301", "JSP")).thenReturn(confirmed);
        when(tasks.findByCourseIdAndChapterOrderByCreatedAtDesc("PRJ301", "Java Server Pages")).thenReturn(List.of());
        when(tasks.save(any())).thenAnswer(invocation -> invocation.getArgument(0));
        CreateChapterTasksRequest request = new CreateChapterTasksRequest();
        request.setCourseId("PRJ301");
        request.setChapter("JSP");
        request.setQuestionCount(1);

        List<ExpertTask> created = service.startChapter(request);

        assertEquals(1, created.size());
        assertEquals("Java Server Pages", created.get(0).getChapter());
    }

    @Test
    void submitGoldQaRunsTextbookBaselineWithoutIndexing() throws Exception {
        ExpertTask task = ExpertTask.builder().id("TASK1").type("GOLD_QA").status("ASSIGNED").build();
        when(tasks.findById("TASK1")).thenReturn(Optional.of(task));
        when(tasks.save(any())).thenAnswer(inv -> inv.getArgument(0));
        GoldQa[] saved = new GoldQa[1];
        when(gold.save(any())).thenAnswer(inv -> {
            GoldQa item = inv.getArgument(0);
            if (item.getId() == null) {
                item.setId("G3");
            }
            saved[0] = item;
            return item;
        });
        when(gold.findById("G3")).thenAnswer(inv -> Optional.ofNullable(saved[0]));
        when(rag.askWithConfidenceFromTextbook(
                eq("PRO là gì?"), eq("PRJ301"), isNull()
        )).thenReturn(CourseRagAnswer.builder()
                .answer("PRO là hệ điều hành thời gian thực.").confidence(0.88)
                .escalationRecommended(false).sources(List.of("ch1")).build());
        SubmitGoldQaRequest request = new SubmitGoldQaRequest();
        request.setCourseId("PRJ301");
        request.setChapter("Khái niệm PRO");
        request.setQuestion("PRO là gì?");
        request.setGoldAnswer("PRO là hệ điều hành thời gian thực.");
        request.setDifficulty("MEDIUM");
        request.setAuthorId("T1");
        request.setSourceTaskId("TASK1");

        GoldQa submitted = service.submitGoldQaAndExam(request);

        assertEquals("BASELINE_EXAMINED", submitted.getStatus());
        assertEquals(true, submitted.getExamPassed());
        assertNotNull(submitted.getExamAiAnswer());
        assertFalse(Boolean.TRUE.equals(submitted.getExamUsedTeachingNote()));
        assertEquals("IN_PROGRESS", task.getStatus());
        verifyNoInteractions(vectors);
        verify(rag).askWithConfidenceFromTextbook(eq("PRO là gì?"), eq("PRJ301"), isNull());
        verify(rag, never()).askWithConfidence(anyString(), anyString(), any());
        verify(rag, never()).askWithConfidencePreviewingTrainingNote(
                anyString(), anyString(), any(), anyString(), anyString());
    }

    @Test
    void firstTeacherExamUsesTextbookOnlyRagWithoutStudentAnswerCache() throws Exception {
        GoldQa draft = GoldQa.builder()
                .id("G-JSPX")
                .courseId("PRJ301")
                .chapter("Using JSPs to Display Content")
                .question("JSP Documents (JSPX) là gì?")
                .goldAnswer("JSPX là JSP dạng XML có phần mở rộng .jspx.")
                .usage("TRAINING")
                .status("DRAFT")
                .authorId("T1")
                .build();
        when(gold.findById("G-JSPX")).thenReturn(Optional.of(draft));
        when(gold.save(any())).thenAnswer(invocation -> invocation.getArgument(0));
        when(rag.askWithConfidenceFromTextbook(
                eq("JSP Documents (JSPX) là gì?"),
                eq("PRJ301"),
                isNull()
        )).thenReturn(CourseRagAnswer.builder()
                .answer("JSPX là JSP dạng XML có phần mở rộng .jspx.")
                .confidence(0.9)
                .escalationRecommended(false)
                .sources(List.of("main-material"))
                .build());

        GoldQa examined = service.examGoldQa("G-JSPX");

        assertEquals("BASELINE_EXAMINED", examined.getStatus());
        assertFalse(Boolean.TRUE.equals(examined.getExamUsedTeachingNote()));
        verify(rag).askWithConfidenceFromTextbook(
                eq("JSP Documents (JSPX) là gì?"),
                eq("PRJ301"),
                isNull()
        );
        verify(rag, never()).askWithConfidence(anyString(), anyString(), any());
    }

    @Test
    void sendGoldQaForReviewNotifiesSeniorOnlyAfterTeacherConfirms() {
        GoldQa draft = GoldQa.builder().id("G4").courseId("PRJ301").usage("TRAINING")
                .status("EXAMINED").authorId("T1").sourceTaskId("TASK1")
                .examAiAnswer("answer").examinedAt(LocalDateTime.now()).examPassed(true)
                .examUsedTeachingNote(true).build();
        ExpertTask task = ExpertTask.builder().id("TASK1").type("GOLD_QA").status("IN_PROGRESS").build();
        when(gold.findById("G4")).thenReturn(Optional.of(draft));
        when(gold.save(any())).thenAnswer(inv -> {
            GoldQa item = inv.getArgument(0);
            draft.setStatus(item.getStatus());
            return item;
        });
        when(gold.findBySourceTaskId("TASK1")).thenAnswer(inv -> List.of(draft));
        when(tasks.findById("TASK1")).thenReturn(Optional.of(task));
        when(tasks.save(any())).thenAnswer(inv -> inv.getArgument(0));

        GoldQa sent = service.sendGoldQaForReview("G4");

        assertEquals("PENDING_REVIEW", sent.getStatus());
        assertEquals("SUBMITTED", task.getStatus());
    }

    @Test
    void submitWithoutGoldQaIdCreatesAdditionalQaOnSameTask() throws Exception {
        ExpertTask task = ExpertTask.builder().id("TASK1").type("GOLD_QA").status("IN_PROGRESS").build();
        GoldQa existing = GoldQa.builder().id("G-OLD").courseId("PRJ301").chapter("JSP")
                .question("Câu cũ?").goldAnswer("Ý cũ").usage("TRAINING").status("EXAMINED")
                .authorId("T1").sourceTaskId("TASK1").build();
        when(tasks.findById("TASK1")).thenReturn(Optional.of(task));
        when(tasks.save(any())).thenAnswer(inv -> inv.getArgument(0));
        GoldQa[] createdRecord = new GoldQa[1];
        when(gold.save(any())).thenAnswer(inv -> {
            GoldQa item = inv.getArgument(0);
            if (item.getId() == null) item.setId("G-NEW");
            if ("G-NEW".equals(item.getId())) createdRecord[0] = item;
            return item;
        });
        when(gold.findById("G-NEW")).thenAnswer(inv -> Optional.ofNullable(createdRecord[0]));
        when(rag.askWithConfidenceFromTextbook(anyString(), anyString(), any()))
                .thenReturn(CourseRagAnswer.builder().answer("JSPX là JSP dạng XML.").confidence(0.9)
                        .escalationRecommended(false).sources(List.of("ch1")).build());

        SubmitGoldQaRequest request = new SubmitGoldQaRequest();
        request.setCourseId("PRJ301");
        request.setChapter("JSP");
        request.setQuestion("JSPX là gì?");
        request.setGoldAnswer("JSPX là JSP dạng XML.");
        request.setDifficulty("MEDIUM");
        request.setAuthorId("T1");
        request.setSourceTaskId("TASK1");

        GoldQa created = service.submitGoldQaAndExam(request);

        assertEquals("G-NEW", created.getId());
        assertNotEquals("G-OLD", created.getId());
        assertEquals("BASELINE_EXAMINED", created.getStatus());
    }

    @Test
    void searchTasksReturnsServerSidePaginationMetadata() {
        ExpertTask row = ExpertTask.builder().id("T1").courseId("PRJ301").type("GOLD_QA").status("OPEN").build();
        when(mongoTemplate.count(any(Query.class), eq(ExpertTask.class))).thenReturn(1001L);
        when(mongoTemplate.find(any(Query.class), eq(ExpertTask.class))).thenReturn(List.of(row));

        Map<String, Object> response = service.searchTasks(
                "OPEN", "PRJ301", null, "GOLD_QA", "JSP", 2, 20, "updatedAt", "desc");

        assertEquals(1001L, response.get("totalElements"));
        assertEquals(51, response.get("totalPages"));
        assertEquals(true, response.get("hasNext"));
        assertEquals(List.of(row), response.get("tasks"));
    }

    @Test
    void updateTaskCanReopenAndUnassignTaskWithoutContribution() {
        ExpertTask task = ExpertTask.builder().id("T1").courseId("PRJ301").chapter("JSP")
                .type("GOLD_QA").title("Old").status("ASSIGNED").assigneeId("TEACHER1").build();
        when(tasks.findById("T1")).thenReturn(Optional.of(task));
        when(gold.findBySourceTaskId("T1")).thenReturn(List.of());
        when(rubrics.findBySourceTaskId("T1")).thenReturn(List.of());
        when(tasks.save(any())).thenAnswer(invocation -> invocation.getArgument(0));
        UpdateExpertTaskRequest request = new UpdateExpertTaskRequest();
        request.setTitle("Updated");
        request.setStatus("OPEN");
        request.setAssigneeId("");

        ExpertTask updated = service.updateTask("T1", request);

        assertEquals("Updated", updated.getTitle());
        assertEquals("OPEN", updated.getStatus());
        assertNull(updated.getAssigneeId());
    }

    @Test
    void deleteTaskRejectsTaskThatAlreadyHasContribution() {
        ExpertTask task = ExpertTask.builder().id("T1").courseId("PRJ301").chapter("JSP")
                .type("GOLD_QA").status("SUBMITTED").build();
        when(tasks.findById("T1")).thenReturn(Optional.of(task));
        when(gold.findBySourceTaskId("T1")).thenReturn(List.of(GoldQa.builder().id("G1").build()));

        assertThrows(IllegalArgumentException.class, () -> service.deleteTask("T1"));
        verify(tasks, never()).delete(any());
    }
}
