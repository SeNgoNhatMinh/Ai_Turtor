package com.ragapi.service.course.indexing;

import com.ragapi.entity.CourseMaterial;
import com.ragapi.service.CourseMaterialAccessPolicy;
import com.ragapi.service.ExpertCoTrainingService;
import com.ragapi.service.HumanLearningService;
import com.ragapi.service.PdfPageRenderService;
import com.ragapi.service.PdfStorageService;
import com.ragapi.service.VisualVectorService;
import com.ragapi.service.course.gateway.CourseMaterialIndexGateway;
import com.ragapi.service.course.gateway.CourseMaterialStoreGateway;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.function.Consumer;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class ReindexProgressTrackerTest {

    private CourseMaterialStoreGateway repository;
    private CourseMaterialIndexExecutor executor;
    private ReindexProgressTracker tracker;
    private ReindexCancellation cancellation;
    private CourseMaterialIndexManagementService service;

    @BeforeEach
    void setUp() {
        repository = mock(CourseMaterialStoreGateway.class);
        executor = mock(CourseMaterialIndexExecutor.class);
        tracker = new ReindexProgressTracker();
        cancellation = new ReindexCancellation();
        service = new CourseMaterialIndexManagementService(
                repository,
                mock(CourseMaterialIndexGateway.class),
                mock(PdfStorageService.class),
                mock(PdfPageRenderService.class),
                mock(VisualVectorService.class),
                new CourseMaterialAccessPolicy(),
                mock(HumanLearningService.class),
                mock(ExpertCoTrainingService.class),
                executor,
                tracker,
                cancellation
        );
    }

    @Test
    void percentFollowsFinishedMaterialsAndCurrentChunks() {
        assertEquals(0, ReindexProgressTracker.percent(0, 2, 0, 10));
        assertEquals(25, ReindexProgressTracker.percent(0, 2, 5, 10));
        assertEquals(50, ReindexProgressTracker.percent(1, 2, 0, 10));
        assertEquals(99, ReindexProgressTracker.percent(1, 2, 10, 10));
        assertEquals(100, ReindexProgressTracker.percent(2, 2, 0, 0));
    }

    @Test
    void courseReindexReportsChunkPercentThenCompletes() throws Exception {
        CourseMaterial material = new CourseMaterial();
        material.setId("m1");
        material.setCourseId("PRJ301");
        material.setTitle("Chương 1");
        material.setContent("nội dung");
        when(repository.findByCourseId("PRJ301")).thenReturn(List.of(material));
        when(executor.reindexAndMark(eq(material), any())).thenAnswer(invocation -> {
            Consumer<CourseMaterialIndexExecutor.IndexProgress> consumer = invocation.getArgument(1);
            consumer.accept(new CourseMaterialIndexExecutor.IndexProgress(
                    "EMBEDDING", 10, 4, 0, 0, 4, 4, 0, null, 4, List.of()));
            Map<String, Object> during = tracker.snapshot("PRJ301");
            assertEquals(40, during.get("percent"));
            assertEquals("EMBEDDING", during.get("stage"));
            assertEquals("Đang tạo embedding", during.get("stageLabel"));
            assertEquals("Tài liệu 1/1 · Chương 1 · Đang tạo embedding · 4/10 đoạn", during.get("message"));
            return new CourseMaterialIndexExecutor.ReindexResult(1, 0, 10, 0);
        });

        service.reindexCourse("PRJ301", "ADMIN");

        Map<String, Object> done = service.reindexProgress("PRJ301", "ADMIN");
        assertEquals("DONE", done.get("status"));
        assertEquals(100, done.get("percent"));
        assertEquals("Đã reindex xong 1 tài liệu", done.get("message"));
    }

    @Test
    void stopDuringABatchCancelsTheCourse() throws Exception {
        CourseMaterial material = new CourseMaterial();
        material.setId("m1");
        material.setCourseId("PRJ301");
        material.setTitle("Chương 1");
        material.setContent("nội dung");
        when(repository.findByCourseId("PRJ301")).thenReturn(List.of(material));
        when(executor.reindexAndMark(eq(material), any())).thenAnswer(invocation -> {
            cancellation.requestStop();
            Consumer<CourseMaterialIndexExecutor.IndexProgress> consumer = invocation.getArgument(1);
            consumer.accept(new CourseMaterialIndexExecutor.IndexProgress(
                    "EMBEDDING", 10, 4, 0, 0, 4, 4, 0, null, 4, List.of()));
            return new CourseMaterialIndexExecutor.ReindexResult(1, 0, 10, 0);
        });

        assertThrows(ReindexCancelledException.class, () -> service.reindexCourse("PRJ301", "ADMIN"));

        Map<String, Object> stopped = service.reindexProgress("PRJ301", "ADMIN");
        assertEquals("CANCELLED", stopped.get("status"));
        assertEquals("Đã dừng", stopped.get("message"));
    }

    @Test
    void retriesAMaterialUntilTheCourseIsIndexed() throws Exception {
        CourseMaterial material = new CourseMaterial();
        material.setId("m1");
        material.setCourseId("PRJ301");
        material.setTitle("Chương 1");
        material.setContent("nội dung");
        when(repository.findByCourseId("PRJ301")).thenReturn(List.of(material));
        AtomicInteger calls = new AtomicInteger();
        when(executor.reindexAndMark(eq(material), any())).thenAnswer(invocation -> {
            if (calls.incrementAndGet() == 1) {
                throw new IllegalStateException("NVIDIA embedding request failed: request timed out");
            }
            return new CourseMaterialIndexExecutor.ReindexResult(0, 0, 2, 0);
        });

        service.reindexCourse("PRJ301", "ADMIN");

        Map<String, Object> done = service.reindexProgress("PRJ301", "ADMIN");
        assertEquals("DONE", done.get("status"));
        assertEquals(2, calls.get());
    }

    @Test
    void teacherCannotReadReindexProgress() {
        assertThrows(SecurityException.class, () -> service.reindexProgress("PRJ301", "TEACHER"));
    }
}
