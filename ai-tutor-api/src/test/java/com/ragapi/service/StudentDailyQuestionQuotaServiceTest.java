package com.ragapi.service;

import com.ragapi.entity.StudentDailyQuestionUsage;
import org.junit.jupiter.api.Test;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.data.mongodb.core.FindAndModifyOptions;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class StudentDailyQuestionQuotaServiceTest {

    @Test
    void returnsRemainingQuestionsAfterAtomicIncrement() {
        MongoTemplate mongoTemplate = mock(MongoTemplate.class);
        StudentDailyQuestionUsage stored = StudentDailyQuestionUsage.builder().questionCount(4).build();
        when(mongoTemplate.findAndModify(
                any(Query.class), any(Update.class), any(FindAndModifyOptions.class),
                eq(StudentDailyQuestionUsage.class))).thenReturn(stored);
        StudentDailyQuestionQuotaService service = new StudentDailyQuestionQuotaService(
                mongoTemplate, 10, "Asia/Bangkok");

        StudentDailyQuestionQuotaService.QuotaUsage result = service.consume("student-1", "PRJ301");

        assertEquals("PRJ301", result.courseId());
        assertEquals(4, result.used());
        assertEquals(6, result.remaining());
    }

    @Test
    void rejectsEleventhQuestionWhenAtomicUpsertHitsExistingDailyDocument() {
        MongoTemplate mongoTemplate = mock(MongoTemplate.class);
        when(mongoTemplate.findAndModify(
                any(Query.class), any(Update.class), any(FindAndModifyOptions.class),
                eq(StudentDailyQuestionUsage.class)))
                .thenThrow(new DuplicateKeyException("daily quota document already exists"));
        StudentDailyQuestionQuotaService service = new StudentDailyQuestionQuotaService(
                mongoTemplate, 10, "Asia/Bangkok");

        StudentDailyQuestionQuotaService.QuestionQuotaExceededException error = assertThrows(
                StudentDailyQuestionQuotaService.QuestionQuotaExceededException.class,
                () -> service.consume("student-1", "PRJ301"));

        assertEquals("PRJ301", error.getCourseId());
        assertEquals(10, error.getDailyLimit());
        assertEquals("Asia/Bangkok", error.getResetAt().getZone().getId());
    }

    @Test
    void requiresAuthenticatedStudentId() {
        StudentDailyQuestionQuotaService service = new StudentDailyQuestionQuotaService(
                mock(MongoTemplate.class), 10, "Asia/Bangkok");
        assertThrows(IllegalArgumentException.class, () -> service.consume(" ", "PRJ301"));
        assertThrows(IllegalArgumentException.class, () -> service.consume("student-1", " "));
    }
}
