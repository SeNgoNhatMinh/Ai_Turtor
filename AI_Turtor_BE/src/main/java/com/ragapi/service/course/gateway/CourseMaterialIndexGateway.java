package com.ragapi.service.course.gateway;

import com.ragapi.service.CourseMaterialChunkingService;

import java.io.IOException;
import java.util.List;

public interface CourseMaterialIndexGateway {

    void indexChunk(
            String courseId,
            String classId,
            String teacherId,
            String materialId,
            String materialScope,
            String sourceType,
            String sourceUrl,
            String sourceDomain,
            String content
    ) throws IOException;

    void indexChunks(
            String courseId,
            String classId,
            String teacherId,
            String materialId,
            String materialScope,
            String sourceType,
            String sourceUrl,
            String sourceDomain,
            List<String> contents
    ) throws IOException;

    void indexHierarchicalChunks(
            String courseId,
            String classId,
            String teacherId,
            String materialId,
            String materialScope,
            String sourceType,
            String sourceUrl,
            String sourceDomain,
            List<CourseMaterialChunkingService.HierarchicalChunk> chunks
    ) throws IOException;

    long deleteChunksByMaterialId(String materialId) throws IOException;
}
