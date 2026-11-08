package com.ragapi.service.behavior.plan;

import java.util.List;

public record StudentLearningProfileSnapshot(
        List<String> learnsBestWith,
        List<String> struggleSignals,
        String pace,
        String teacherNote
) {
    public static final StudentLearningProfileSnapshot EMPTY =
            new StudentLearningProfileSnapshot(List.of(), List.of(), null, null);

    public boolean isEmpty() {
        return (learnsBestWith == null || learnsBestWith.isEmpty())
                && (struggleSignals == null || struggleSignals.isEmpty())
                && (pace == null || pace.isBlank())
                && (teacherNote == null || teacherNote.isBlank());
    }
}
