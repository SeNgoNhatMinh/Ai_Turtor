package com.ragapi.controller;

import com.ragapi.dto.UpdateCourseMaterialMetadataRequest;
import com.ragapi.entity.CourseMaterial;
import com.ragapi.repository.CourseMaterialRepository;
import com.ragapi.service.AccessGuardService;
import com.ragapi.service.CourseMaterialAccessPolicy;
import com.ragapi.service.CourseMaterialHtmlImportService;
import com.ragapi.service.CourseMaterialIngestionService;
import com.ragapi.service.CourseMaterialLifecycleService;
import com.ragapi.service.CourseMaterialQueryService;
import com.ragapi.service.PdfPageRenderService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class CourseMaterialControllerAuthorizationTest {

    private CourseMaterialIngestionService ingestionService;
    private CourseMaterialRepository repository;
    private AccessGuardService accessGuardService;
    private CourseMaterialController controller;

    @BeforeEach
    void setUp() {
        ingestionService = mock(CourseMaterialIngestionService.class);
        repository = mock(CourseMaterialRepository.class);
        accessGuardService = mock(AccessGuardService.class);
        controller = new CourseMaterialController(
                ingestionService,
                mock(CourseMaterialHtmlImportService.class),
                repository,
                mock(PdfPageRenderService.class),
                mock(CourseMaterialLifecycleService.class),
                mock(CourseMaterialQueryService.class),
                new CourseMaterialAccessPolicy(),
                accessGuardService
        );
        ReflectionTestUtils.setField(controller, "maxMaterialUploadMb", 50L);
    }

    @Test
    void teacherCannotUpdateMainMaterialEvenWhenTeacherIdMatches() {
        CourseMaterial mainMaterial = material("main-1", "PRJ301", "teacher-1", "ADMIN", "COURSE_SHARED");
        when(repository.findById("main-1")).thenReturn(Optional.of(mainMaterial));

        var response = controller.updateCourseMaterialMetadata(
                "PRJ301",
                "main-1",
                new UpdateCourseMaterialMetadataRequest("Changed", "Main"),
                authentication("teacher-1", "TEACHER")
        );

        assertEquals(HttpStatus.FORBIDDEN, response.getStatusCode());
        verify(repository, never()).save(mainMaterial);
    }

    @Test
    void teacherUploadCannotSpoofAdminOrAnotherTeacherIdentity() throws Exception {
        MockMultipartFile pdf = new MockMultipartFile(
                "file",
                "teacher-note.pdf",
                "application/pdf",
                "%PDF-1.4 test".getBytes()
        );
        CourseMaterial stored = material("material-1", "PRJ301", "teacher-1", "TEACHER", "CLASS_SECTION");
        stored.setClassId("PRJ301-01");
        stored.setTitle("Teacher note");
        stored.setSourceFileName("teacher-note.pdf");
        stored.setIndexingStatus("PROCESSING");
        when(ingestionService.ingestPdfAsync(
                eq(pdf),
                eq("Teacher note"),
                eq("course-material"),
                eq("PRJ301"),
                eq("PRJ301-01"),
                eq("teacher-1"),
                eq("CLASS_SECTION"),
                eq("TEACHER")
        )).thenReturn(stored);

        var response = controller.uploadCourseMaterial(
                "PRJ301",
                "PRJ301-01",
                "admin-id-from-client",
                "Teacher note",
                "ADMIN",
                pdf,
                authentication("teacher-1", "TEACHER")
        );

        assertEquals(HttpStatus.ACCEPTED, response.getStatusCode());
        verify(accessGuardService).allowTeacherForClassOrAdmin(
                "teacher-1", "TEACHER", "PRJ301", "PRJ301-01");
        verify(ingestionService).ingestPdfAsync(
                pdf,
                "Teacher note",
                "course-material",
                "PRJ301",
                "PRJ301-01",
                "teacher-1",
                "CLASS_SECTION",
                "TEACHER"
        );
    }

    private Authentication authentication(String userId, String role) {
        return new UsernamePasswordAuthenticationToken(
                userId,
                null,
                List.of(new SimpleGrantedAuthority("ROLE_" + role))
        );
    }

    private CourseMaterial material(
            String id,
            String courseId,
            String teacherId,
            String uploadedByRole,
            String materialScope
    ) {
        CourseMaterial material = new CourseMaterial();
        material.setId(id);
        material.setCourseId(courseId);
        material.setTeacherId(teacherId);
        material.setUploadedByRole(uploadedByRole);
        material.setMaterialScope(materialScope);
        return material;
    }
}
