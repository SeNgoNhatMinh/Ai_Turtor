package com.ragapi.service.course.indexing;

/** Stops the in-memory reindex run. The indexing loop checks this between batches. */
public class ReindexCancelledException extends RuntimeException {

    public ReindexCancelledException() {
        super("Đã dừng");
    }
}
