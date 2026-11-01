package com.ragapi.service;

import com.ragapi.entity.User;
import org.junit.jupiter.api.Test;

import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class UserOwnedRecordCleanupTest {

    @Test
    void identityKeysIncludeAccountIdEmailAndStudentCode() {
        User user = User.builder()
                .id("c48453a6-d40d-428d-97d1-d65a627c941d")
                .email("se185018@gmail.com")
                .studentCode("SE185018")
                .fullName("học ngu")
                .build();

        Set<String> keys = UserOwnedRecordCleanup.identityKeys(user);

        assertEquals(3, keys.size());
        assertTrue(keys.contains("c48453a6-d40d-428d-97d1-d65a627c941d"));
        assertTrue(keys.contains("se185018@gmail.com"));
        assertTrue(keys.contains("SE185018"));
    }

    @Test
    void personalRowsAreDeletedAndSharedAcademicRowsAreOnlyUnlinked() {
        assertTrue(UserOwnedRecordCleanup.ACCESS_RECORDS.contains("auth_refresh_tokens"));
        assertTrue(UserOwnedRecordCleanup.ACCESS_RECORDS.contains("student_llm_credentials"));
        assertTrue(UserOwnedRecordCleanup.ACCESS_RECORDS.stream().noneMatch(name ->
                name.equals("course_enrollments") || name.equals("assignment_submissions")
                        || name.equals("quiz_sessions") || name.equals("course_materials")));
        assertTrue(UserOwnedRecordCleanup.OWNED_BY_STUDENT_ID.contains("course_enrollments"));
        assertTrue(UserOwnedRecordCleanup.OWNED_BY_USER_ID.contains("ai_conversations"));
        assertTrue(UserOwnedRecordCleanup.OWNED_BY_USER_ID.contains("auth_refresh_tokens"));
        assertTrue(UserOwnedRecordCleanup.SHARED_USER_REFS.stream()
                .anyMatch(ref -> ref.collection().equals("class_sections") && ref.field().equals("teacherId")));
        assertTrue(UserOwnedRecordCleanup.SHARED_USER_REFS.stream()
                .noneMatch(ref -> ref.collection().equals("courses") || ref.collection().equals("class_sections") && ref.field().equals("courseId")));
        assertTrue(UserOwnedRecordCleanup.OWNED_BY_STUDENT_ID.stream().noneMatch(name -> name.equals("courses") || name.equals("class_sections") || name.equals("course_materials")));
    }
}
