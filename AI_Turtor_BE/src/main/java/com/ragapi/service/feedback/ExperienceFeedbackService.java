package com.ragapi.service.feedback;

import com.ragapi.entity.ExperienceFeedback;
import com.ragapi.entity.User;
import com.ragapi.repository.UserRepository;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.function.Function;

/** Experience survey for the test period: one answer per account, a summary for admins. */
@Service
public class ExperienceFeedbackService {

    static final int MAX_TEXT = 2000;
    static final Set<String> DEVICES = Set.of("COMPUTER", "PHONE", "TABLET");
    static final List<String> FEATURES = List.of("CHAT", "LESSONS", "QUIZ", "MATERIALS", "TEACHER_SUPPORT");

    private final MongoTemplate mongoTemplate;
    private final UserRepository userRepository;

    public ExperienceFeedbackService(MongoTemplate mongoTemplate, UserRepository userRepository) {
        this.mongoTemplate = mongoTemplate;
        this.userRepository = userRepository;
    }

    public ExperienceFeedback findMine(String userId) {
        return mongoTemplate.findById(userId, ExperienceFeedback.class);
    }

    /** Validates and saves the caller's answer, replacing an earlier one. */
    public ExperienceFeedback submit(String userId, ExperienceFeedback input) {
        if (userId == null || userId.isBlank()) throw new SecurityException("Login required");
        if (input == null) throw new IllegalArgumentException("Thiếu nội dung khảo sát");

        List<String> features = input.getFeaturesUsed() == null ? List.of() : input.getFeaturesUsed().stream()
                .map(value -> String.valueOf(value).trim().toUpperCase())
                .filter(FEATURES::contains)
                .distinct()
                .toList();
        String device = input.getDevice() == null ? null : input.getDevice().trim().toUpperCase();
        if (device != null && !DEVICES.contains(device)) throw new IllegalArgumentException("Thiết bị không hợp lệ");
        boolean hadIssues = Boolean.TRUE.equals(input.getHadIssues());

        ExperienceFeedback existing = findMine(userId);
        User user = userRepository.findById(userId).orElse(null);
        Instant now = Instant.now();
        ExperienceFeedback saved = ExperienceFeedback.builder()
                .userId(userId)
                .email(user == null ? null : user.getEmail())
                .fullName(user == null ? null : user.getFullName())
                .role(user == null ? null : user.getRole())
                .courseId(trim(input.getCourseId(), 40))
                .classId(trim(input.getClassId(), 40))
                .overall(rating(input.getOverall(), 1, 5, "Mức độ hài lòng chung"))
                .aiQuality(rating(input.getAiQuality(), 1, 5, "Chất lượng câu trả lời AI"))
                .speed(rating(input.getSpeed(), 1, 5, "Tốc độ phản hồi"))
                .easeOfUse(rating(input.getEaseOfUse(), 1, 5, "Mức độ dễ sử dụng"))
                .recommend(rating(input.getRecommend(), 0, 10, "Mức độ sẵn sàng giới thiệu"))
                .device(device)
                .featuresUsed(features)
                .hadIssues(hadIssues)
                .issueDetail(hadIssues ? trim(input.getIssueDetail(), MAX_TEXT) : null)
                .liked(trim(input.getLiked(), MAX_TEXT))
                .improve(trim(input.getImprove(), MAX_TEXT))
                .createdAt(existing == null || existing.getCreatedAt() == null ? now : existing.getCreatedAt())
                .updatedAt(now)
                .build();
        return mongoTemplate.save(saved);
    }

    /** All answers (newest first) plus averages and counts for the admin page. */
    public Map<String, Object> summary() {
        List<ExperienceFeedback> items = mongoTemplate.find(
                new Query().with(Sort.by(Sort.Direction.DESC, "updatedAt")), ExperienceFeedback.class);
        Map<String, Object> averages = new LinkedHashMap<>();
        averages.put("overall", average(items, ExperienceFeedback::getOverall));
        averages.put("aiQuality", average(items, ExperienceFeedback::getAiQuality));
        averages.put("speed", average(items, ExperienceFeedback::getSpeed));
        averages.put("easeOfUse", average(items, ExperienceFeedback::getEaseOfUse));
        averages.put("recommend", average(items, ExperienceFeedback::getRecommend));

        int promoters = 0;
        int detractors = 0;
        int rated = 0;
        Map<String, Integer> devices = new LinkedHashMap<>();
        Map<String, Integer> features = new LinkedHashMap<>();
        FEATURES.forEach(feature -> features.put(feature, 0));
        int issues = 0;
        for (ExperienceFeedback item : items) {
            Integer recommend = item.getRecommend();
            if (recommend != null) {
                rated++;
                if (recommend >= 9) promoters++;
                else if (recommend <= 6) detractors++;
            }
            if (item.getDevice() != null) devices.merge(item.getDevice(), 1, Integer::sum);
            if (item.getFeaturesUsed() != null) item.getFeaturesUsed().forEach(f -> features.merge(f, 1, Integer::sum));
            if (Boolean.TRUE.equals(item.getHadIssues())) issues++;
        }
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("count", items.size());
        result.put("averages", averages);
        // Net Promoter Score: % rating 9–10 minus % rating 0–6.
        result.put("nps", rated == 0 ? null : Math.round((promoters - detractors) * 100.0 / rated));
        result.put("devices", devices);
        result.put("features", features);
        result.put("issueCount", issues);
        result.put("items", new ArrayList<>(items));
        return result;
    }

    private static Integer rating(Integer value, int min, int max, String label) {
        if (value == null) throw new IllegalArgumentException("Vui lòng chọn: " + label);
        if (value < min || value > max) throw new IllegalArgumentException(label + " phải từ " + min + " đến " + max);
        return value;
    }

    private static Double average(List<ExperienceFeedback> items, Function<ExperienceFeedback, Integer> field) {
        return items.stream().map(field).filter(v -> v != null).mapToInt(Integer::intValue).average()
                .stream().boxed().map(v -> Math.round(v * 100.0) / 100.0).findFirst().orElse(null);
    }

    private static String trim(String value, int max) {
        if (value == null) return null;
        String trimmed = value.trim();
        if (trimmed.isEmpty()) return null;
        return trimmed.length() > max ? trimmed.substring(0, max) : trimmed;
    }
}
