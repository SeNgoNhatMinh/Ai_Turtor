package com.ragapi.service.course.indexing;

import com.ragapi.entity.CourseMaterialIndexJob;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import java.io.IOException;
import java.util.Optional;

import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.mockito.ArgumentMatchers.anyString;

class CourseMaterialIndexJobWorkerTest {

    private CourseMaterialIndexJobService jobService;
    private CourseMaterialIndexingService indexingService;
    private CourseMaterialIndexJobWorker worker;

    @BeforeEach
    void setUp() {
        jobService = mock(CourseMaterialIndexJobService.class);
        indexingService = mock(CourseMaterialIndexingService.class);
        worker = new CourseMaterialIndexJobWorker(jobService, indexingService);
        ReflectionTestUtils.setField(worker, "enabled", true);
        ReflectionTestUtils.setField(worker, "batchSize", 1);
        ReflectionTestUtils.setField(worker, "completedRetentionDays", 14);
    }

    @Test
    void processNextJobMarksSuccessfulIndexingCompleted() throws IOException {
        CourseMaterialIndexJob job = job();
        when(jobService.claimNext(anyString())).thenReturn(Optional.of(job));

        worker.processNextJob();

        verify(indexingService).processQueuedIndex("material-1");
        verify(jobService).markCompleted("job-1");
        verify(jobService, never()).retryOrFail(job, null);
    }

    @Test
    void processNextJobSchedulesRetryWhenIndexingFails() throws IOException {
        CourseMaterialIndexJob job = job();
        IOException failure = new IOException("Elasticsearch unavailable");
        when(jobService.claimNext(anyString())).thenReturn(Optional.of(job));
        org.mockito.Mockito.doThrow(failure)
                .when(indexingService).processQueuedIndex("material-1");

        worker.processNextJob();

        verify(jobService).retryOrFail(job, failure);
        verify(jobService, never()).markCompleted("job-1");
    }

    @Test
    void disabledWorkerDoesNotClaimJobs() {
        ReflectionTestUtils.setField(worker, "enabled", false);

        worker.processNextJob();

        verify(jobService, never()).claimNext(anyString());
    }

    private CourseMaterialIndexJob job() {
        return CourseMaterialIndexJob.builder()
                .id("job-1")
                .materialId("material-1")
                .retryCount(0)
                .maxRetries(3)
                .status(CourseMaterialIndexJob.PROCESSING)
                .build();
    }
}
