package com.ragapi.service.course.indexing;

import org.springframework.stereotype.Component;

import java.util.concurrent.atomic.AtomicBoolean;

@Component
public class ReindexCancellation {

    private final AtomicBoolean stopRequested = new AtomicBoolean();

    public void requestStop() {
        stopRequested.set(true);
    }

    public void clear() {
        stopRequested.set(false);
    }

    public boolean isStopRequested() {
        return stopRequested.get();
    }
}
