package com.ragapi.service.course.model;

public record RetrievedCourseChunk(
        String content,
        Double score,
        String materialId,
        String courseId,
        String classId,
        String teacherId,
        String materialScope,
        String sourceType,
        String documentId,
        String chapterId,
        String chapterTitle,
        String sectionId,
        String sectionTitle,
        String chunkId,
        Integer chunkIndex,
        String nodeType
) {
    public RetrievedCourseChunk withScore(Double updatedScore) {
        return new RetrievedCourseChunk(
                content,
                updatedScore,
                materialId,
                courseId,
                classId,
                teacherId,
                materialScope,
                sourceType,
                documentId,
                chapterId,
                chapterTitle,
                sectionId,
                sectionTitle,
                chunkId,
                chunkIndex,
                nodeType
        );
    }

    public RetrievedCourseChunk(
            String content,
            Double score,
            String materialId,
            String courseId,
            String classId,
            String teacherId,
            String materialScope
    ) {
        this(content, score, materialId, courseId, classId, teacherId, materialScope, null,
                materialId, null, null, null, null, null, null, "CHUNK");
    }

    public RetrievedCourseChunk(
            String content,
            Double score,
            String materialId,
            String courseId,
            String classId,
            String teacherId,
            String materialScope,
            String sourceType
    ) {
        this(content, score, materialId, courseId, classId, teacherId, materialScope, sourceType,
                materialId, null, null, null, null, null, null, "CHUNK");
    }
}
