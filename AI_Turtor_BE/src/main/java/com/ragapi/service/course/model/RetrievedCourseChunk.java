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
        String nodeType,
        String language,
        java.util.List<String> technicalTerms
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
                nodeType,
                language,
                technicalTerms
        );
    }

    public RetrievedCourseChunk(
            String content, Double score, String materialId, String courseId, String classId,
            String teacherId, String materialScope, String sourceType, String documentId,
            String chapterId, String chapterTitle, String sectionId, String sectionTitle,
            String chunkId, Integer chunkIndex, String nodeType
    ) {
        this(content, score, materialId, courseId, classId, teacherId, materialScope, sourceType,
                documentId, chapterId, chapterTitle, sectionId, sectionTitle, chunkId, chunkIndex,
                nodeType, null, java.util.List.of());
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
                materialId, null, null, null, null, null, null, "CHUNK", null, java.util.List.of());
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
                materialId, null, null, null, null, null, null, "CHUNK", null, java.util.List.of());
    }
}
