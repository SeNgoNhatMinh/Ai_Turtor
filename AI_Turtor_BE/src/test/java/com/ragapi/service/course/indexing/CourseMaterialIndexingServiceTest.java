package com.ragapi.service.course.indexing;

import com.ragapi.entity.CourseMaterial;
import com.ragapi.service.course.gateway.CourseMaterialStoreGateway;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class CourseMaterialIndexingServiceTest {

    private CourseMaterialStoreGateway repository;
    private CourseMaterialStorageService storageService;
    private CourseMaterialIndexExecutor indexExecutor;
    private CourseMaterialIndexJobService jobService;
    private CourseMaterialIndexingService service;

    @BeforeEach
    void setUp() {
        repository = mock(CourseMaterialStoreGateway.class);
        storageService = mock(CourseMaterialStorageService.class);
        indexExecutor = mock(CourseMaterialIndexExecutor.class);
        jobService = mock(CourseMaterialIndexJobService.class);
        service = new CourseMaterialIndexingService(
                repository,
                storageService,
                indexExecutor,
                jobService
        );
    }

    @Test
    void asynchronousPdfUploadStoresMaterialAndEnqueuesJob() throws IOException {
        MultipartFile file = mock(MultipartFile.class);
        CourseMaterial material = material();
        when(storageService.storePdfMaterial(
                file,
                "Servlet",
                "course-material",
                "PRJ301",
                "SE1832",
                "teacher-1",
                "CLASS_SECTION",
                "TEACHER"
        )).thenReturn(material);

        CourseMaterial result = service.ingestPdfAsync(
                file,
                "Servlet",
                "course-material",
                "PRJ301",
                "SE1832",
                "teacher-1",
                "CLASS_SECTION",
                "TEACHER"
        );

        assertThat(result).isSameAs(material);
        verify(jobService).enqueue(material);
        verify(indexExecutor, never()).indexAndMark(material);
    }

    @Test
    void queuedJobLoadsMaterialAndRunsExecutor() throws IOException {
        CourseMaterial material = material();
        when(repository.findById("material-1")).thenReturn(Optional.of(material));

        service.processQueuedIndex("material-1");

        verify(indexExecutor).markProcessing(material);
        verify(indexExecutor).indexAndMark(material);
    }

    @Test
    void directIngestionMarksMaterialBeforeIndexing() throws IOException {
        CourseMaterial material = material();

        service.ingest(material);

        verify(indexExecutor).markProcessing(material);
        verify(indexExecutor).indexAndMark(material);
        verify(jobService, never()).enqueue(material);
    }

    private CourseMaterial material() {
        CourseMaterial material = new CourseMaterial();
        material.setId("material-1");
        material.setCourseId("PRJ301");
        material.setTitle("Servlet");
        return material;
    }
}
