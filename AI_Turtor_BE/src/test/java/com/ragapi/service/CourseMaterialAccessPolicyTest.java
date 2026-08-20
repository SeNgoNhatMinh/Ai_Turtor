package com.ragapi.service;

import com.ragapi.entity.CourseMaterial;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertThrows;

class CourseMaterialAccessPolicyTest {

    private final CourseMaterialAccessPolicy policy = new CourseMaterialAccessPolicy();

    @Test
    void teacherCanManageMaterialTheyUploadedToTheirClass() {
        CourseMaterial material = teacherMaterial("teacher-1");

        assertDoesNotThrow(() -> policy.requireManagePermission(material, "teacher-1", "TEACHER"));
    }

    @Test
    void teacherCannotManageAnotherTeachersMaterial() {
        CourseMaterial material = teacherMaterial("teacher-2");

        assertThrows(SecurityException.class,
                () -> policy.requireManagePermission(material, "teacher-1", "TEACHER"));
    }

    @Test
    void teacherCannotManageMainMaterialEvenWhenLegacyTeacherIdMatches() {
        CourseMaterial material = teacherMaterial("teacher-1");
        material.setUploadedByRole("ADMIN");
        material.setMaterialScope("COURSE_SHARED");

        assertThrows(SecurityException.class,
                () -> policy.requireManagePermission(material, "teacher-1", "TEACHER"));
    }

    @Test
    void seniorAndAdminCanManageMainMaterial() {
        CourseMaterial material = teacherMaterial(null);
        material.setUploadedByRole("ADMIN");
        material.setMaterialScope("COURSE_SHARED");

        assertDoesNotThrow(() -> policy.requireManagePermission(material, "senior-1", "SENIOR_MENTOR"));
        assertDoesNotThrow(() -> policy.requireManagePermission(material, "admin-1", "ADMIN"));
    }

    @Test
    void onlySeniorOrAdminCanRequestManualReindex() {
        assertThrows(SecurityException.class, () -> policy.requireReindexPermission("TEACHER"));
        assertDoesNotThrow(() -> policy.requireReindexPermission("SENIOR_MENTOR"));
        assertDoesNotThrow(() -> policy.requireReindexPermission("ADMIN"));
    }

    private CourseMaterial teacherMaterial(String teacherId) {
        CourseMaterial material = new CourseMaterial();
        material.setTeacherId(teacherId);
        material.setUploadedByRole("TEACHER");
        material.setMaterialScope("CLASS_SECTION");
        return material;
    }
}
