package com.ragapi.service.course.indexing;

import io.micrometer.core.instrument.Counter;
import io.micrometer.core.instrument.MeterRegistry;
import org.springframework.stereotype.Component;

/** Metrics emitted by the durable course-material indexing queue. */
@Component
public class CourseMaterialIndexJobMetrics {

    private final Counter enqueued;
    private final Counter completed;
    private final Counter retried;
    private final Counter failed;
    private final Counter recovered;

    public CourseMaterialIndexJobMetrics(MeterRegistry registry) {
        enqueued = registry.counter("course.material.index.jobs", "result", "enqueued");
        completed = registry.counter("course.material.index.jobs", "result", "completed");
        retried = registry.counter("course.material.index.jobs", "result", "retry");
        failed = registry.counter("course.material.index.jobs", "result", "failed");
        recovered = registry.counter("course.material.index.jobs", "result", "recovered");
    }

    public void enqueued() {
        enqueued.increment();
    }

    public void completed() {
        completed.increment();
    }

    public void retried() {
        retried.increment();
    }

    public void failed() {
        failed.increment();
    }

    public void recovered(long count) {
        recovered.increment(Math.max(0, count));
    }
}
