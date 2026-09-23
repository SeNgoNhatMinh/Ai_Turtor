package com.ragapi.service.course.indexing;

import com.mongodb.client.result.UpdateResult;
import com.ragapi.entity.CourseMaterial;
import com.ragapi.entity.CourseMaterialIndexJob;
import com.ragapi.repository.CourseMaterialIndexJobRepository;
import org.bson.Document;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.data.mongodb.core.FindAndModifyOptions;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class CourseMaterialIndexJobServiceTest {

    private CourseMaterialIndexJobRepository repository;
    private MongoTemplate mongoTemplate;
    private CourseMaterialIndexJobRecoveryService recoveryService;
    private CourseMaterialIndexJobMetrics metrics;
    private CourseMaterialIndexJobService service;

    @BeforeEach
    void setUp() {
        repository = mock(CourseMaterialIndexJobRepository.class);
        mongoTemplate = mock(MongoTemplate.class);
        recoveryService = mock(CourseMaterialIndexJobRecoveryService.class);
        metrics = mock(CourseMaterialIndexJobMetrics.class);
        service = new CourseMaterialIndexJobService(repository, mongoTemplate, recoveryService, metrics);
        ReflectionTestUtils.setField(service, "configuredMaxRetries", 3);
    }

    @Test
    void enqueueCreatesIdempotentPendingJob() {
        CourseMaterial material = material();
        when(repository.findByIdempotencyKey("material-1:1:abc123"))
                .thenReturn(Optional.empty());
        when(repository.save(any(CourseMaterialIndexJob.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

        CourseMaterialIndexJob job = service.enqueue(material);

        assertThat(job.getIdempotencyKey()).isEqualTo("material-1:1:abc123");
        assertThat(job.getMaterialId()).isEqualTo("material-1");
        assertThat(job.getCourseId()).isEqualTo("PRJ301");
        assertThat(job.getStatus()).isEqualTo(CourseMaterialIndexJob.PENDING);
        assertThat(job.getRetryCount()).isZero();
        assertThat(job.getMaxRetries()).isEqualTo(3);
        assertThat(job.getNextAttemptAt()).isNotNull();
    }

    @Test
    void enqueueReturnsExistingJobForSameMaterialVersionAndHash() {
        CourseMaterial material = material();
        CourseMaterialIndexJob existing = CourseMaterialIndexJob.builder()
                .id("job-1")
                .idempotencyKey("material-1:1:abc123")
                .build();
        when(repository.findByIdempotencyKey("material-1:1:abc123"))
                .thenReturn(Optional.of(existing));

        CourseMaterialIndexJob result = service.enqueue(material);

        assertThat(result).isSameAs(existing);
        verify(repository, never()).save(any());
    }

    @Test
    void claimNextAtomicallyMovesReadyJobToProcessing() {
        CourseMaterialIndexJob claimed = CourseMaterialIndexJob.builder()
                .id("job-1")
                .status(CourseMaterialIndexJob.PROCESSING)
                .build();
        when(mongoTemplate.updateMulti(any(Query.class), any(Update.class),
                eq(CourseMaterialIndexJob.class)))
                .thenReturn(UpdateResult.acknowledged(0, 0L, null));
        when(mongoTemplate.findAndModify(
                any(Query.class),
                any(Update.class),
                any(FindAndModifyOptions.class),
                eq(CourseMaterialIndexJob.class)))
                .thenReturn(claimed);

        Optional<CourseMaterialIndexJob> result = service.claimNext();

        assertThat(result).containsSame(claimed);
        ArgumentCaptor<Update> updateCaptor = ArgumentCaptor.forClass(Update.class);
        verify(mongoTemplate).findAndModify(
                any(Query.class),
                updateCaptor.capture(),
                any(FindAndModifyOptions.class),
                eq(CourseMaterialIndexJob.class));
        assertThat(setValues(updateCaptor.getValue()).getString("status"))
                .isEqualTo(CourseMaterialIndexJob.PROCESSING);
    }

    @Test
    void retryOrFailSchedulesRetryBeforeLimit() {
        CourseMaterialIndexJob job = CourseMaterialIndexJob.builder()
                .id("job-1")
                .retryCount(0)
                .maxRetries(3)
                .build();

        service.retryOrFail(job, new IllegalStateException("provider unavailable"));

        ArgumentCaptor<Update> updateCaptor = ArgumentCaptor.forClass(Update.class);
        verify(mongoTemplate).updateFirst(
                any(Query.class),
                updateCaptor.capture(),
                eq(CourseMaterialIndexJob.class));
        Document values = setValues(updateCaptor.getValue());
        assertThat(values.getString("status")).isEqualTo(CourseMaterialIndexJob.RETRY);
        assertThat(values.getInteger("retryCount")).isEqualTo(1);
        assertThat(values.getString("lastError")).isEqualTo("provider unavailable");
        assertThat(values.get("nextAttemptAt")).isNotNull();
    }

    @Test
    void retryOrFailMarksJobFailedAtRetryLimit() {
        CourseMaterialIndexJob job = CourseMaterialIndexJob.builder()
                .id("job-1")
                .retryCount(2)
                .maxRetries(3)
                .build();

        service.retryOrFail(job, new IllegalStateException("still unavailable"));

        ArgumentCaptor<Update> updateCaptor = ArgumentCaptor.forClass(Update.class);
        verify(mongoTemplate).updateFirst(
                any(Query.class),
                updateCaptor.capture(),
                eq(CourseMaterialIndexJob.class));
        Document values = setValues(updateCaptor.getValue());
        assertThat(values.getString("status")).isEqualTo(CourseMaterialIndexJob.FAILED);
        assertThat(values.getInteger("retryCount")).isEqualTo(3);
        Document unsetValues = updateCaptor.getValue().getUpdateObject().get("$unset", Document.class);
        assertThat(unsetValues).containsKey("nextAttemptAt");
    }

    private Document setValues(Update update) {
        return update.getUpdateObject().get("$set", Document.class);
    }

    private CourseMaterial material() {
        CourseMaterial material = new CourseMaterial();
        material.setId("material-1");
        material.setCourseId("PRJ301");
        material.setContentHash("ABC123");
        return material;
    }
}
