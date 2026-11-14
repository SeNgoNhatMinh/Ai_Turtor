package com.ragapi.service.course.indexing;

import com.ragapi.service.CourseMaterialAccessPolicy;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class ReindexRunServiceTest {

    @Test
    void stopLeavesTheCurrentCourseAndSkipsTheRest() throws Exception {
        CourseMaterialIndexManagementService materials = mock(CourseMaterialIndexManagementService.class);
        CountDownLatch inside = new CountDownLatch(1);
        CountDownLatch release = new CountDownLatch(1);
        when(materials.reindexCourse(eq("PRJ301"), eq("ADMIN"))).thenAnswer(invocation -> {
            inside.countDown();
            assertTrue(release.await(5, TimeUnit.SECONDS));
            throw new ReindexCancelledException();
        });
        ExecutorService pool = Executors.newSingleThreadExecutor();
        ReindexRunService runs = new ReindexRunService(
                materials,
                new ReindexCancellation(),
                new ReindexProgressTracker(),
                new CourseMaterialAccessPolicy(),
                pool
        );
        try {
            runs.start(List.of("PRJ301", "OSG202"), "ADMIN");
            assertTrue(inside.await(5, TimeUnit.SECONDS));
            assertEquals("STOPPING", runs.stop("ADMIN").get("status"));
            release.countDown();

            Map<String, Object> finished = waitUntilSettled(runs);
            assertEquals("CANCELLED", finished.get("status"));
            verify(materials, never()).reindexCourse(eq("OSG202"), any());
        } finally {
            pool.shutdownNow();
        }
    }

    @Test
    void currentRunStaysVisibleAfterTheCallerReturns() throws Exception {
        CourseMaterialIndexManagementService materials = mock(CourseMaterialIndexManagementService.class);
        CountDownLatch release = new CountDownLatch(1);
        when(materials.reindexCourse(eq("PRJ301"), eq("ADMIN"))).thenAnswer(invocation -> {
            assertTrue(release.await(5, TimeUnit.SECONDS));
            return Map.of("indexedChunks", 4, "reindexedMaterials", 1);
        });
        ExecutorService pool = Executors.newSingleThreadExecutor();
        ReindexRunService runs = new ReindexRunService(
                materials,
                new ReindexCancellation(),
                new ReindexProgressTracker(),
                new CourseMaterialAccessPolicy(),
                pool
        );
        try {
            Map<String, Object> started = runs.start(List.of("PRJ301"), "ADMIN");
            assertEquals("RUNNING", started.get("status"));
            Map<String, Object> stillRunning = runs.current("ADMIN");
            assertEquals("RUNNING", stillRunning.get("status"));
            release.countDown();
            assertEquals("DONE", waitUntilSettled(runs).get("status"));
        } finally {
            pool.shutdownNow();
        }
    }

    private static Map<String, Object> waitUntilSettled(ReindexRunService runs) throws InterruptedException {
        long deadline = System.currentTimeMillis() + 5000;
        Map<String, Object> current = runs.current("ADMIN");
        while (("RUNNING".equals(current.get("status")) || "STOPPING".equals(current.get("status")))
                && System.currentTimeMillis() < deadline) {
            Thread.sleep(20);
            current = runs.current("ADMIN");
        }
        return current;
    }
}
