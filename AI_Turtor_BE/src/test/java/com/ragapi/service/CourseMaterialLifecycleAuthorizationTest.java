package com.ragapi.service;

import com.ragapi.entity.CourseMaterial;
import com.ragapi.repository.CourseMaterialRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

class CourseMaterialLifecycleAuthorizationTest {

    private CourseMaterialRepository repository;
    private ElasticVectorService vectorService;
    private VisualVectorService visualVectorService;
    private CourseMaterialLifecycleService service;

    @BeforeEach
    void setUp() {
        repository = mock(CourseMaterialRepository.class);
        vectorService = mock(ElasticVectorService.class);
        visualVectorService = mock(VisualVectorService.class);
        service = new CourseMaterialLifecycleService(
                repository,
                mock(CourseMaterialChunkingService.class),
                vectorService,
                mock(PdfStorageService.class),
                mock(PdfPageRenderService.class),
                visualVectorService,
                new CourseMaterialAccessPolicy()
        );
    }

    @Test
    void teacherCannotDeleteMainMaterial() {
        CourseMaterial mainMaterial = material("main-1", "teacher-1", "ADMIN", "COURSE_SHARED");
        when(repository.findById("main-1")).thenReturn(Optional.of(mainMaterial));

        assertThrows(SecurityException.class,
                () -> service.deleteMaterial("PRJ301", "main-1", "teacher-1", "TEACHER"));

        verifyNoInteractions(vectorService, visualVectorService);
        verify(repository, never()).deleteById("main-1");
    }

    @Test
    void teacherCanDeleteOnlyTheirOwnClassMaterial() throws Exception {
        CourseMaterial ownMaterial = material("own-1", "teacher-1", "TEACHER", "CLASS_SECTION");
        when(repository.findById("own-1")).thenReturn(Optional.of(ownMaterial));
        when(vectorService.deleteChunksByMaterialId("own-1")).thenReturn(3L);
        when(visualVectorService.deleteMaterial("own-1")).thenReturn(2L);

        var result = service.deleteMaterial("PRJ301", "own-1", "teacher-1", "TEACHER");

        assertEquals("DELETED", result.get("status"));
        assertEquals(3L, result.get("deletedChunks"));
        verify(repository).deleteById("own-1");
    }

    private CourseMaterial material(
            String id,
            String teacherId,
            String uploadedByRole,
            String materialScope
    ) {
        CourseMaterial material = new CourseMaterial();
        material.setId(id);
        material.setCourseId("PRJ301");
        material.setTeacherId(teacherId);
        material.setUploadedByRole(uploadedByRole);
        material.setMaterialScope(materialScope);
        return material;
    }
}
