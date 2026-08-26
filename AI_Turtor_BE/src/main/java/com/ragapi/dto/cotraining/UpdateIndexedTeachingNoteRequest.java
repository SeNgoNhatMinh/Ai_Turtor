package com.ragapi.dto.cotraining;

import lombok.Data;

@Data
public class UpdateIndexedTeachingNoteRequest {
    private String chapter;
    private String question;
    private String goldAnswer;
    /** When true (default), rewrite Elasticsearch after saving Mongo fields. */
    private Boolean reindex = true;
}
