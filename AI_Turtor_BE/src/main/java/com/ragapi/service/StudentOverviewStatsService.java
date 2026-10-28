package com.ragapi.service;

import com.ragapi.entity.AdaptiveLearningReview;
import com.ragapi.entity.AiConversation;
import com.ragapi.entity.AiMessage;
import com.ragapi.entity.QuizSession;
import com.ragapi.entity.StudentDailyQuestionUsage;
import com.ragapi.repository.AdaptiveLearningReviewRepository;
import com.ragapi.repository.AiConversationRepository;
import com.ragapi.repository.AiMessageRepository;
import com.ragapi.repository.QuizSessionRepository;
import com.ragapi.repository.StudentDailyQuestionUsageRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.TreeSet;

@Service
public class StudentOverviewStatsService {

    private static final List<String> STUDENT_ROLES = List.of("STUDENT", "USER");

    private final AiConversationRepository conversationRepository;
    private final AiMessageRepository messageRepository;
    private final QuizSessionRepository quizSessionRepository;
    private final AdaptiveLearningReviewRepository reviewRepository;
    private final StudentDailyQuestionUsageRepository usageRepository;
    private final ZoneId zoneId;

    public StudentOverviewStatsService(
            AiConversationRepository conversationRepository,
            AiMessageRepository messageRepository,
            QuizSessionRepository quizSessionRepository,
            AdaptiveLearningReviewRepository reviewRepository,
            StudentDailyQuestionUsageRepository usageRepository,
            @Value("${app.timezone:Asia/Bangkok}") String timezone
    ) {
        this.conversationRepository = conversationRepository;
        this.messageRepository = messageRepository;
        this.quizSessionRepository = quizSessionRepository;
        this.reviewRepository = reviewRepository;
        this.usageRepository = usageRepository;
        String resolvedTimezone = timezone == null || timezone.isBlank() ? "Asia/Bangkok" : timezone;
        this.zoneId = ZoneId.of(resolvedTimezone);
    }

    public Map<String, Object> build(String studentId) {
        if (studentId == null || studentId.isBlank()) {
            throw new IllegalArgumentException("Student ID is required");
        }
        String safeStudentId = studentId.trim();
        LocalDate today = LocalDate.now(zoneId);
        Activity total = new Activity();
        Map<String, Activity> courses = new HashMap<>();

        List<AiConversation> conversations = conversationRepository.findAllByUserId(safeStudentId);
        Map<String, String> courseByConversation = new HashMap<>();
        for (AiConversation conversation : conversations) {
            if (conversation == null || conversation.getId() == null) continue;
            String courseId = normalizeCourseId(conversation.getCourseId());
            courseByConversation.put(conversation.getId(), courseId);
            total.askCount++;
            if (!courseId.isEmpty()) course(courses, courseId).askCount++;
        }

        List<String> conversationIds = new ArrayList<>(courseByConversation.keySet());
        if (!conversationIds.isEmpty()) {
            for (AiMessage message : messageRepository.findByConversationIdInAndRoleIn(conversationIds, STUDENT_ROLES)) {
                if (message == null || !isStudentRole(message.getRole())) continue;
                String courseId = courseByConversation.getOrDefault(message.getConversationId(), "");
                total.questionCount++;
                if (!courseId.isEmpty()) course(courses, courseId).questionCount++;
                addQuestionActivity(
                        total,
                        courseId.isEmpty() ? null : course(courses, courseId),
                        message.getCreatedAt()
                );
            }
        }

        for (QuizSession quiz : quizSessionRepository.findByStudentIdOrderByCreatedAtDesc(safeStudentId)) {
            if (!isSubmitted(quiz)) continue;
            String courseId = normalizeCourseId(quiz.getCourseId());
            Activity course = courseId.isEmpty() ? null : course(courses, courseId);
            int answered = answeredCount(quiz);
            total.quizQuestionCount += answered;
            total.quizAttemptCount++;
            if (course != null) {
                course.quizQuestionCount += answered;
                course.quizAttemptCount++;
            }
            Integer percent = percentOf(quiz);
            LocalDateTime when = quiz.getSubmittedAt() != null ? quiz.getSubmittedAt() : quiz.getCreatedAt();
            if (percent != null) {
                total.quizPercents.add(new TimedPercent(when, percent));
                if (course != null) course.quizPercents.add(new TimedPercent(when, percent));
            }
            addQuizActivity(total, course, when, answered);
        }

        for (AdaptiveLearningReview review : reviewRepository.findByStudentIdOrderByCreatedAtAsc(safeStudentId)) {
            if (review == null || review.getOverallPercent() == null) continue;
            String courseId = normalizeCourseId(review.getCourseId());
            total.reviewPercents.add(review.getOverallPercent());
            if (!courseId.isEmpty()) course(courses, courseId).reviewPercents.add(review.getOverallPercent());
            addDay(total, courseId.isEmpty() ? null : course(courses, courseId), review.getCreatedAt());
        }

        for (StudentDailyQuestionUsage usage : usageRepository.findByStudentId(safeStudentId)) {
            if (usage == null || usage.getQuestionCount() <= 0 || usage.getUsageDate() == null) continue;
            String courseId = normalizeCourseId(usage.getCourseId());
            total.days.add(usage.getUsageDate());
            if (!courseId.isEmpty()) course(courses, courseId).days.add(usage.getUsageDate());
        }

        List<Map<String, Object>> courseStats = courses.entrySet().stream()
                .sorted(Map.Entry.comparingByKey())
                .map(entry -> toStats(entry.getKey(), entry.getValue(), today))
                .toList();

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("studentId", safeStudentId);
        Map<String, Object> summary = toStats(null, total, today);
        summary.put("activeCourseCount", courses.values().stream().filter(Activity::hasActivity).count());
        response.put("summary", summary);
        response.put("week", buildWeek(total, today));
        response.put("courses", courseStats);
        return response;
    }

    private static Activity course(Map<String, Activity> courses, String courseId) {
        return courses.computeIfAbsent(courseId, ignored -> new Activity());
    }

    private static void addDay(Activity total, Activity course, LocalDateTime timestamp) {
        if (timestamp == null) return;
        LocalDate day = timestamp.toLocalDate();
        total.days.add(day);
        if (course != null) course.days.add(day);
    }

    private static void addQuestionActivity(Activity total, Activity course, LocalDateTime timestamp) {
        addDay(total, course, timestamp);
        if (timestamp == null) return;
        LocalDate day = timestamp.toLocalDate();
        total.questionsByDay.merge(day, 1, Integer::sum);
        if (course != null) course.questionsByDay.merge(day, 1, Integer::sum);
    }

    private static void addQuizActivity(Activity total, Activity course, LocalDateTime timestamp, int answered) {
        addDay(total, course, timestamp);
        if (timestamp == null) return;
        LocalDate day = timestamp.toLocalDate();
        total.quizAttemptsByDay.merge(day, 1, Integer::sum);
        total.quizQuestionsByDay.merge(day, answered, Integer::sum);
        if (course != null) {
            course.quizAttemptsByDay.merge(day, 1, Integer::sum);
            course.quizQuestionsByDay.merge(day, answered, Integer::sum);
        }
    }

    private static List<Map<String, Object>> buildWeek(Activity activity, LocalDate today) {
        return StudyActivityMath.week(activity.days, today).stream()
                .map(day -> {
                    LocalDate date = LocalDate.parse(String.valueOf(day.get("date")));
                    int questions = activity.questionsByDay.getOrDefault(date, 0);
                    int quizQuestions = activity.quizQuestionsByDay.getOrDefault(date, 0);
                    int quizAttempts = activity.quizAttemptsByDay.getOrDefault(date, 0);
                    day.put("questionCount", questions);
                    day.put("quizQuestionCount", quizQuestions);
                    day.put("quizAttemptCount", quizAttempts);
                    day.put("activityCount", questions + quizQuestions);
                    return day;
                })
                .toList();
    }

    private static Map<String, Object> toStats(String courseId, Activity activity, LocalDate today) {
        List<Integer> mastery = masterySeries(activity);
        Map<String, Object> stats = new LinkedHashMap<>();
        if (courseId != null) stats.put("courseId", courseId);
        stats.put("questionCount", activity.questionCount);
        stats.put("askCount", activity.askCount);
        stats.put("quizQuestionCount", activity.quizQuestionCount);
        stats.put("quizAttemptCount", activity.quizAttemptCount);
        stats.put("averageQuizPercent", averageQuizPercent(activity.quizPercents));
        stats.put("improvementPercent", StudyActivityMath.improvementPercent(mastery));
        stats.put("latestMasteryPercent", StudyActivityMath.latestPercent(mastery));
        stats.put("studyDayCount", activity.days.size());
        stats.put("streakDays", StudyActivityMath.streakDays(activity.days, today));
        return stats;
    }

    private static Integer averageQuizPercent(List<TimedPercent> attempts) {
        if (attempts == null || attempts.isEmpty()) return null;
        return (int) Math.round(attempts.stream().mapToInt(TimedPercent::percent).average().orElse(0));
    }

    private static List<Integer> masterySeries(Activity activity) {
        if (activity.reviewPercents.size() >= 2) return activity.reviewPercents;
        if (activity.quizPercents.size() >= 2) {
            return activity.quizPercents.stream()
                    .sorted(Comparator.comparing(item -> item.at == null ? LocalDateTime.MIN : item.at))
                    .map(item -> item.percent)
                    .toList();
        }
        if (!activity.reviewPercents.isEmpty()) return activity.reviewPercents;
        return activity.quizPercents.stream()
                .sorted(Comparator.comparing(item -> item.at == null ? LocalDateTime.MIN : item.at))
                .map(item -> item.percent)
                .toList();
    }

    private static boolean isStudentRole(String role) {
        if (role == null) return false;
        return STUDENT_ROLES.contains(role.trim().toUpperCase(Locale.ROOT));
    }

    private static boolean isSubmitted(QuizSession quiz) {
        if (quiz == null) return false;
        if (quiz.getSubmittedAt() != null) return true;
        return "SUBMITTED".equalsIgnoreCase(quiz.getStatus());
    }

    private static int answeredCount(QuizSession quiz) {
        if (quiz.getAnswers() != null) {
            int selected = 0;
            for (QuizSession.QuizAnswer answer : quiz.getAnswers()) {
                if (answer != null && answer.getSelectedAnswer() != null && !answer.getSelectedAnswer().isBlank()) {
                    selected++;
                }
            }
            if (selected > 0) return selected;
        }
        return quiz.getQuestions() == null ? 0 : quiz.getQuestions().size();
    }

    private static Integer percentOf(QuizSession quiz) {
        if (quiz.getPercentage() != null) return (int) Math.round(quiz.getPercentage());
        if (quiz.getScore() != null && quiz.getMaxScore() != null && quiz.getMaxScore() > 0) {
            return (int) Math.round(quiz.getScore() * 100.0 / quiz.getMaxScore());
        }
        return null;
    }

    private static String normalizeCourseId(String courseId) {
        if (courseId == null || courseId.isBlank()) return "";
        return courseId.trim().toUpperCase(Locale.ROOT);
    }

    private static final class Activity {
        private int questionCount;
        private int askCount;
        private int quizQuestionCount;
        private int quizAttemptCount;
        private final List<Integer> reviewPercents = new ArrayList<>();
        private final List<TimedPercent> quizPercents = new ArrayList<>();
        private final TreeSet<LocalDate> days = new TreeSet<>();
        private final Map<LocalDate, Integer> questionsByDay = new HashMap<>();
        private final Map<LocalDate, Integer> quizQuestionsByDay = new HashMap<>();
        private final Map<LocalDate, Integer> quizAttemptsByDay = new HashMap<>();

        private boolean hasActivity() {
            return questionCount > 0 || quizAttemptCount > 0 || askCount > 0 || !days.isEmpty();
        }
    }

    private record TimedPercent(LocalDateTime at, int percent) {
    }
}
