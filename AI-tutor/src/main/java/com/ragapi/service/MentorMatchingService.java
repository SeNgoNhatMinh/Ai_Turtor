package com.ragapi.service;

import com.ragapi.dto.MentorSuggestionDTO;
import com.ragapi.entity.Mentor;
import com.ragapi.repository.MentorRepository;
import lombok.AllArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.stream.Collectors;

/**
 * MentorMatchingService - TÃ¬m mentor phÃ¹ há»£p dá»±a trÃªn question
 * Sá»­ dá»¥ng Levenshtein distance ï¿½'ï¿½f tÃ­nh ï¿½'ï¿½T tÆ°Æ¡ng ï¿½'ï¿½"ng keyword
 */
@Slf4j
@Service
@AllArgsConstructor
public class MentorMatchingService {

    private MentorRepository mentorRepository;

    /**
     * TÃ¬m top 5 mentor phÃ¹ há»£p vï¿½>i question
     */
    public List<MentorSuggestionDTO> findMatchingMentors(String question, Integer limit) {
        try {
            // 1. Get all active mentors
            List<Mentor> activeMentors = mentorRepository.findByIsActiveTrue();

            if (activeMentors.isEmpty()) {
                log.warn("No active mentors found");
                return Collections.emptyList();
            }

            // 2. Tokenize & normalize question
            List<String> questionTokens = tokenizeAndNormalize(question);

            // 3. Score mï¿½-i mentor
            Map<Mentor, Double> scoreMap = new HashMap<>();
            for (Mentor mentor : activeMentors) {
                double score = calculateMatchScore(questionTokens, mentor);
                if (score > 0) {
                    scoreMap.put(mentor, score);
                }
            }

            // 4. Sort by score & return top N
            return scoreMap.entrySet().stream()
                    .sorted((e1, e2) -> Double.compare(e2.getValue(), e1.getValue()))
                    .limit(limit != null ? limit : 5)
                    .map(entry -> mapToDTO(entry.getKey(), entry.getValue()))
                    .collect(Collectors.toList());

        } catch (Exception e) {
            log.error("Error finding matching mentors", e);
            return Collections.emptyList();
        }
    }

    /**
     * Calculate match score dá»±a trÃªn keywords
     */
    private double calculateMatchScore(List<String> questionTokens, Mentor mentor) {
        double score = 0;

        // 1. Keyword matching (mï¿½-i match = 30 points)
        if (mentor.getKeywords() != null) {
            for (String keyword : mentor.getKeywords()) {
                for (String token : questionTokens) {
                    double similarity = calculateSimilarity(token, keyword);
                    if (similarity >= 0.7) {
                        score += 30;
                        break; // Mï¿½-i keyword chï¿½? tÃ­nh 1 láº§n
                    }
                }
            }
        }

        // 2. Category matching (30 points)
        if (mentor.getCategories() != null) {
            for (String category : mentor.getCategories()) {
                for (String token : questionTokens) {
                    if (token.contains(category) || category.contains(token)) {
                        score += 30;
                        break;
                    }
                }
            }
        }

        // 3. Specialization matching (20 points)
        if (mentor.getSpecializations() != null) {
            for (String spec : mentor.getSpecializations()) {
                for (String token : questionTokens) {
                    double similarity = calculateSimilarity(token, spec);
                    if (similarity >= 0.7) {
                        score += 20;
                        break;
                    }
                }
            }
        }

        // 4. Rating bonus (10 points náº¿u rating >= 4.0)
        if (mentor.getAverageRating() != null && mentor.getAverageRating() >= 4.0) {
            score += 10;
        }

        // 5. Response time bonus (5 points náº¿u response < 5 minutes)
        if (mentor.getResponseTimeMinutes() != null && mentor.getResponseTimeMinutes() < 5) {
            score += 5;
        }

        // 6. Availability bonus (10 points when mentor still has capacity)
        int currentSessions = mentor.getCurrentActiveChatSessions() == null ? 0 : mentor.getCurrentActiveChatSessions();
        int maxSessions = mentor.getMaxConcurrentChats() == null ? 5 : mentor.getMaxConcurrentChats();
        if (currentSessions < maxSessions) {
            score += 10;
        }

        return score;
    }

    /**
     * TÃ­nh ï¿½'ï¿½T tÆ°Æ¡ng ï¿½'ï¿½"ng giá»¯a 2 strings (Levenshtein distance)
     * Range: 0-1 (1 = identical)
     */
    private double calculateSimilarity(String s1, String s2) {
        s1 = s1.toLowerCase();
        s2 = s2.toLowerCase();

        int maxLen = Math.max(s1.length(), s2.length());
        if (maxLen == 0) return 1.0;

        int distance = levenshteinDistance(s1, s2);
        return 1.0 - (double) distance / maxLen;
    }

    /**
     * Calculate Levenshtein distance
     */
    private int levenshteinDistance(String s1, String s2) {
        int[][] dp = new int[s1.length() + 1][s2.length() + 1];

        for (int i = 0; i <= s1.length(); i++) {
            dp[i][0] = i;
        }
        for (int j = 0; j <= s2.length(); j++) {
            dp[0][j] = j;
        }

        for (int i = 1; i <= s1.length(); i++) {
            for (int j = 1; j <= s2.length(); j++) {
                int cost = s1.charAt(i - 1) == s2.charAt(j - 1) ? 0 : 1;
                dp[i][j] = Math.min(Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1), dp[i - 1][j - 1] + cost);
            }
        }

        return dp[s1.length()][s2.length()];
    }

    /**
     * Tokenize vÃ  normalize question (lowercase, xÃ³a dáº¥u, remove stopwords)
     */
    private List<String> tokenizeAndNormalize(String question) {
        if (question == null || question.isBlank()) {
            return Collections.emptyList();
        }
        String normalized = removeVietnameseTones(question.toLowerCase());

        // Remove special characters, split by space
        String[] tokens = normalized.split("[\\s\\p{Punct}]+");

        Set<String> stopwords = getVietnameseStopwords();

        return Arrays.stream(tokens)
                .filter(token -> !token.isEmpty() && !stopwords.contains(token))
                .collect(Collectors.toList());
    }

    /**
     * Remove Vietnamese diacritical marks
     */
    private String removeVietnameseTones(String str) {
        String nfd = java.text.Normalizer.normalize(str, java.text.Normalizer.Form.NFD);
        return nfd.replaceAll("\\p{InCombiningDiacriticalMarks}+", "");
    }

    /**
     * Danh sÃ¡ch stopwords tiáº¿ng Viï¿½?t
     */
    private Set<String> getVietnameseStopwords() {
        return Set.of("la", "le", "lam", "dung", "co", "khong", "toi", "ban", "anh", "chi",
                      "em", "can", "muon", "dieu", "neu", "va", "hay", "hoac", "nhu", "sau");
    }

    /**
     * Map tá»« Mentor entity sang MentorSuggestionDTO
     */
    private MentorSuggestionDTO mapToDTO(Mentor mentor, double score) {
        // Normalize score to 0-100
        double normalizedScore = Math.min(score / 2.0, 100.0);

        return MentorSuggestionDTO.builder()
                .id(mentor.getId())
                .mentorName(mentor.getMentorName())
                .avatarUrl(mentor.getAvatarUrl())
                .averageRating(mentor.getAverageRating())
                .completedMentorSessions(mentor.getCompletedMentorSessions())
                .description(mentor.getDescription())
                .matchScore(normalizedScore)
                .matchReason(generateMatchReason(mentor))
                .responseTimeMinutes(mentor.getResponseTimeMinutes())
                .specializations(mentor.getSpecializations())
                .build();
    }

    /**
     * Generate match reason message
     */
    private String generateMatchReason(Mentor mentor) {
        StringBuilder reason = new StringBuilder();
        reason.append("Chuyên môn: ");

        if (mentor.getSpecializations() != null && !mentor.getSpecializations().isEmpty()) {
            reason.append(String.join(", ", mentor.getSpecializations().stream()
                    .limit(2).collect(Collectors.toList())));
        } else {
            reason.append("Mentor match");
        }

        if (mentor.getAverageRating() != null) {
            reason.append(" | Đánh giá: ").append(String.format("%.1f", mentor.getAverageRating())).append("⭐");
        }

        return reason.toString();
    }
}
