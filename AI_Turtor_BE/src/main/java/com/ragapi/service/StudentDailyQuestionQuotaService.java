package com.ragapi.service;

import com.ragapi.entity.StudentDailyQuestionUsage;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.data.mongodb.core.FindAndModifyOptions;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.ZonedDateTime;

@Service
public class StudentDailyQuestionQuotaService {

    private final MongoTemplate mongoTemplate;
    private final int dailyLimit;
    private final ZoneId zoneId;

    public StudentDailyQuestionQuotaService(
            MongoTemplate mongoTemplate,
            @Value("${app.student-question-quota.daily-limit:10}") int dailyLimit,
            @Value("${app.timezone:Asia/Bangkok}") String timezone
    ) {
        this.mongoTemplate = mongoTemplate;
        this.dailyLimit = Math.max(1, dailyLimit);
        this.zoneId = ZoneId.of(timezone);
    }

    public QuotaUsage consume(String studentId, String courseId) {
        if (studentId == null || studentId.isBlank()) {
            throw new IllegalArgumentException("Authenticated student ID is required");
        }
        if (courseId == null || courseId.isBlank()) {
            throw new IllegalArgumentException("Course ID is required for question quota");
        }
        String safeStudentId = studentId.trim();
        String safeCourseId = courseId.trim().toUpperCase(java.util.Locale.ROOT);
        ZonedDateTime now = ZonedDateTime.now(zoneId);
        LocalDate usageDate = now.toLocalDate();
        String documentId = documentId(safeStudentId, safeCourseId, usageDate);
        Query query = Query.query(Criteria.where("_id").is(documentId)
                .and("questionCount").lt(dailyLimit));
        Update update = new Update()
                .setOnInsert("studentId", safeStudentId)
                .setOnInsert("courseId", safeCourseId)
                .setOnInsert("usageDate", usageDate)
                .setOnInsert("createdAt", LocalDateTime.from(now))
                .set("updatedAt", LocalDateTime.from(now))
                .inc("questionCount", 1);
        try {
            StudentDailyQuestionUsage usage = mongoTemplate.findAndModify(
                    query,
                    update,
                    FindAndModifyOptions.options().returnNew(true).upsert(true),
                    StudentDailyQuestionUsage.class
            );
            if (usage == null) {
                throw quotaExceeded(safeCourseId, now);
            }
            return toUsage(safeCourseId, usage.getQuestionCount(), now);
        } catch (DuplicateKeyException exhausted) {
            // The fixed _id already exists but did not match questionCount < dailyLimit.
            throw quotaExceeded(safeCourseId, now);
        }
    }

    public QuotaUsage currentUsage(String studentId, String courseId) {
        if (studentId == null || studentId.isBlank() || courseId == null || courseId.isBlank()) {
            throw new IllegalArgumentException("Student ID and course ID are required");
        }
        ZonedDateTime now = ZonedDateTime.now(zoneId);
        String documentId = documentId(
                studentId.trim(),
                courseId.trim().toUpperCase(java.util.Locale.ROOT),
                now.toLocalDate()
        );
        StudentDailyQuestionUsage usage = mongoTemplate.findById(documentId, StudentDailyQuestionUsage.class);
        int used = usage == null ? 0 : Math.max(0, usage.getQuestionCount());
        return toUsage(courseId.trim().toUpperCase(java.util.Locale.ROOT), used, now);
    }

    public int dailyLimit() {
        return dailyLimit;
    }

    private QuotaUsage toUsage(String courseId, int used, ZonedDateTime now) {
        int clamped = Math.min(used, dailyLimit);
        return new QuotaUsage(courseId, clamped, Math.max(0, dailyLimit - clamped), resetAt(now));
    }

    private String documentId(String studentId, String courseId, LocalDate usageDate) {
        return studentId + ":" + courseId + ":" + usageDate;
    }

    private QuestionQuotaExceededException quotaExceeded(String courseId, ZonedDateTime now) {
        return new QuestionQuotaExceededException(courseId, dailyLimit, resetAt(now));
    }

    private ZonedDateTime resetAt(ZonedDateTime now) {
        return now.toLocalDate().plusDays(1).atStartOfDay(zoneId);
    }

    public record QuotaUsage(String courseId, int used, int remaining, ZonedDateTime resetAt) {}

    public static class QuestionQuotaExceededException extends RuntimeException {
        private final String courseId;
        private final int dailyLimit;
        private final ZonedDateTime resetAt;

        public QuestionQuotaExceededException(String courseId, int dailyLimit, ZonedDateTime resetAt) {
            super("Daily course question limit reached");
            this.courseId = courseId;
            this.dailyLimit = dailyLimit;
            this.resetAt = resetAt;
        }

        public String getCourseId() {
            return courseId;
        }

        public int getDailyLimit() {
            return dailyLimit;
        }

        public ZonedDateTime getResetAt() {
            return resetAt;
        }
    }
}
