package com.ragapi.harness.review;

import com.ragapi.dto.AiAnswerReviewEvidenceItem;
import com.ragapi.dto.GroupedAiAnswerReviewItem;
import com.ragapi.harness.entity.AiAnswerReview;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import lombok.RequiredArgsConstructor;

/** Groups pending answer reviews into the teacher queue. */
@RequiredArgsConstructor
class AnswerReviewQueue {

    private final int redAlertNegativeCount;
    private final double similarQuestionOverlap;

    String groupKey(AiAnswerReview review) {
        // listGroupedPending already filters by queue status. A fingerprint is
        // therefore the canonical group key; tier changes must not split cards.
        // Legacy records may not have answerFingerprint, so derive it from the
        // canonical course/question/answer tuple instead of splitting by id.
        return effectiveFingerprint(review);
    }

    GroupedAiAnswerReviewItem toGroupedItem(List<AiAnswerReview> members, String queueStatus) {
        List<AiAnswerReview> sorted = members.stream()
                .sorted(Comparator.comparing(AiAnswerReview::getCreatedAt, Comparator.nullsLast(Comparator.naturalOrder())))
                .toList();
        AiAnswerReview head = sorted.get(sorted.size() - 1);
        Map<String, AiAnswerReview> latestByStudent = new LinkedHashMap<>();
        for (AiAnswerReview item : sorted) {
            String studentKey = item.getStudentId() == null || item.getStudentId().isBlank()
                    ? "review:" + item.getId()
                    : "student:" + item.getStudentId().trim();
            latestByStudent.put(studentKey, item);
        }
        List<AiAnswerReviewEvidenceItem> evidence = latestByStudent.values().stream()
                .map(this::toEvidenceItem)
                .toList();
        double averageRating = sorted.stream()
                .map(AiAnswerReview::getRating)
                .filter(Objects::nonNull)
                .mapToInt(Integer::intValue)
                .average()
                .orElse(0.0);

        int distinctStudentCount = (int) sorted.stream()
                .map(AiAnswerReview::getStudentId)
                .filter(Objects::nonNull)
                .map(String::trim)
                .filter(id -> !id.isEmpty())
                .distinct()
                .count();
        int negativeReviewCount = (int) sorted.stream()
                .filter(this::isNegativeRating)
                .count();
        List<String> uniqueQuestions = sorted.stream()
                .map(AiAnswerReview::getQuestion)
                .filter(question -> question != null && !question.isBlank())
                .map(String::trim)
                .distinct()
                .toList();
        List<String> similarQuestions = uniqueQuestions.stream()
                .filter(question -> !question.equals(head.getQuestion()))
                .limit(6)
                .toList();
        boolean redAlert = negativeReviewCount >= redAlertNegativeCount
                || distinctStudentCount >= redAlertNegativeCount;
        String alertLevel = redAlert
                ? "RED"
                : (distinctStudentCount <= 1 && negativeReviewCount <= 1 ? "WATCH" : "ATTENTION");

        return GroupedAiAnswerReviewItem.builder()
                .answerFingerprint(effectiveFingerprint(head))
                .courseId(head.getCourseId())
                .classId(head.getClassId())
                .question(head.getQuestion())
                .answer(head.getAnswer())
                .mode(head.getMode())
                .aiConfidence(head.getAiConfidence())
                .queueStatus(queueStatus)
                .escalationTier(head.getEscalationTier())
                .distinctStudentCount(distinctStudentCount)
                .reviewCount(sorted.size())
                .negativeReviewCount(negativeReviewCount)
                .similarQuestionCount(uniqueQuestions.size())
                .similarQuestions(similarQuestions)
                .alertLevel(alertLevel)
                .redAlert(redAlert)
                .averageRating(averageRating)
                .firstReportedAt(sorted.get(0).getCreatedAt())
                .lastReportedAt(head.getCreatedAt())
                .representativeReviewId(head.getId())
                .reviews(evidence)
                .build();
    }

    List<List<AiAnswerReview>> clusterSimilarFingerprintGroups(List<List<AiAnswerReview>> groups) {
        int size = groups.size();
        int[] parent = new int[size];
        for (int i = 0; i < size; i++) {
            parent[i] = i;
        }
        for (int i = 0; i < size; i++) {
            for (int j = i + 1; j < size; j++) {
                if (sameCourse(groups.get(i), groups.get(j)) && similarQuestions(groups.get(i), groups.get(j))) {
                    int left = findCluster(parent, i);
                    int right = findCluster(parent, j);
                    if (left != right) {
                        parent[right] = left;
                    }
                }
            }
        }
        Map<Integer, List<AiAnswerReview>> clustered = new LinkedHashMap<>();
        for (int i = 0; i < size; i++) {
            clustered.computeIfAbsent(findCluster(parent, i), ignored -> new ArrayList<>()).addAll(groups.get(i));
        }
        return new ArrayList<>(clustered.values());
    }

    int findCluster(int[] parent, int index) {
        if (parent[index] != index) {
            parent[index] = findCluster(parent, parent[index]);
        }
        return parent[index];
    }

    boolean sameCourse(List<AiAnswerReview> left, List<AiAnswerReview> right) {
        String leftCourse = left.isEmpty() ? null : left.get(0).getCourseId();
        String rightCourse = right.isEmpty() ? null : right.get(0).getCourseId();
        return Objects.equals(leftCourse, rightCourse);
    }

    boolean similarQuestions(List<AiAnswerReview> left, List<AiAnswerReview> right) {
        List<String> leftQuestions = uniqueQuestions(left);
        List<String> rightQuestions = uniqueQuestions(right);
        for (String leftQuestion : leftQuestions) {
            for (String rightQuestion : rightQuestions) {
                if (com.ragapi.harness.util.QuestionOverlapUtil.areSimilarQuestions(leftQuestion, rightQuestion, similarQuestionOverlap)) {
                    return true;
                }
            }
        }
        return false;
    }

    List<String> uniqueQuestions(List<AiAnswerReview> reviews) {
        return reviews.stream()
                .map(AiAnswerReview::getQuestion)
                .filter(question -> question != null && !question.isBlank())
                .map(String::trim)
                .distinct()
                .toList();
    }

    boolean isNegativeRating(AiAnswerReview review) {
        Integer rating = review.getRating();
        return rating != null && rating <= 3;
    }

    Comparator<GroupedAiAnswerReviewItem> queueUrgencyOrder() {
        return Comparator
                .comparing((GroupedAiAnswerReviewItem item) -> !item.isRedAlert())
                .thenComparingInt(item -> alertRank(item.getAlertLevel()))
                .thenComparing(GroupedAiAnswerReviewItem::getNegativeReviewCount, Comparator.reverseOrder())
                .thenComparing(GroupedAiAnswerReviewItem::getDistinctStudentCount, Comparator.reverseOrder())
                .thenComparing(
                        GroupedAiAnswerReviewItem::getLastReportedAt,
                        Comparator.nullsLast(Comparator.reverseOrder())
                );
    }

    int alertRank(String alertLevel) {
        if ("RED".equalsIgnoreCase(alertLevel)) {
            return 0;
        }
        if ("ATTENTION".equalsIgnoreCase(alertLevel)) {
            return 1;
        }
        return 2;
    }

    AiAnswerReviewEvidenceItem toEvidenceItem(AiAnswerReview review) {
        return AiAnswerReviewEvidenceItem.builder()
                .reviewId(review.getId())
                .studentId(review.getStudentId())
                .rating(review.getRating())
                .accurate(review.getAccurate())
                .helpful(review.getHelpful())
                .reviewType(review.getReviewType())
                .feedback(review.getFeedback())
                .suggestedCorrection(review.getSuggestedCorrection())
                .createdAt(review.getCreatedAt())
                .build();
    }


    private String answerFingerprint(String courseId, String question, String answer) {
        String payload = normalizeFingerprintPart(courseId)
                + "|"
                + normalizeFingerprintPart(question)
                + "|"
                + normalizeFingerprintPart(answer);
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(payload.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(hash);
        } catch (Exception e) {
            throw new IllegalStateException("Cannot fingerprint AI answer review", e);
        }
    }

    private String effectiveFingerprint(AiAnswerReview review) {
        if (review.getAnswerFingerprint() != null && !review.getAnswerFingerprint().isBlank()) {
            return review.getAnswerFingerprint().trim();
        }
        return answerFingerprint(review.getCourseId(), review.getQuestion(), review.getAnswer());
    }

    private String normalizeFingerprintPart(String value) {
        if (value == null) {
            return "";
        }
        return value.trim().replaceAll("\\s+", " ").toLowerCase();
    }

}
