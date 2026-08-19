package com.ragapi.util;

import org.springframework.web.multipart.MultipartFile;

import java.text.Normalizer;
import java.util.Arrays;
import java.util.Locale;
import java.util.Set;
import java.util.stream.Collectors;

public final class ValidationUtils {

    public static final int DEFAULT_TEXT_MAX_LENGTH = 20_000;
    public static final int SHORT_TEXT_MAX_LENGTH = 500;
    public static final int REVIEW_NOTE_MAX_LENGTH = 4_000;
    public static final int STUDENT_QUESTION_MAX_LENGTH = 4_000;
    public static final int CODE_SNIPPET_MAX_LENGTH = 12_000;
    public static final int CODE_SNIPPET_MAX_LINES = 100;
    public static final int KNOWLEDGE_IMAGE_MAX_COUNT = 6;
    public static final int KNOWLEDGE_IMAGE_MAX_SIZE_MB = 5;

    private static final Set<String> PLACEHOLDER_VALUES = Set.of(
            "paste_here",
            "paste_id_here",
            "paste_escalation_id_here",
            "paste_candidate_id_here",
            "paste_real_id_here",
            "id_here",
            "esc-id",
            "candidate-id",
            "id_candidate_that",
            "id_escalation_that",
            "pastecandidateidhere",
            "pasteescalationidhere",
            "paste_candidate_id",
            "paste_escalation_id"
    );

    private ValidationUtils() {
    }

    public static String requireText(String value, String fieldName) {
        if (value == null || value.isBlank()) {
            throw new IllegalArgumentException(fieldName + " is required");
        }
        String trimmed = value.trim();
        rejectPlaceholder(trimmed, fieldName);
        return trimmed;
    }

    public static String optionalText(String value, String fieldName) {
        if (value == null || value.isBlank()) {
            return null;
        }
        String trimmed = value.trim();
        rejectPlaceholder(trimmed, fieldName);
        return trimmed;
    }

    public static String requireMaxLength(String value, String fieldName, int maxLength) {
        String trimmed = requireText(value, fieldName);
        if (trimmed.length() > maxLength) {
            throw new IllegalArgumentException(fieldName + " must not exceed " + maxLength + " characters");
        }
        return trimmed;
    }

    public static String optionalMaxLength(String value, String fieldName, int maxLength) {
        String trimmed = optionalText(value, fieldName);
        if (trimmed != null && trimmed.length() > maxLength) {
            throw new IllegalArgumentException(fieldName + " must not exceed " + maxLength + " characters");
        }
        return trimmed;
    }

    public static String optionalCodeSnippet(String value, String fieldName) {
        String code = optionalMaxLength(value, fieldName, CODE_SNIPPET_MAX_LENGTH);
        if (code == null) {
            return null;
        }
        int lineCount = code.split("\\R", -1).length;
        if (lineCount > CODE_SNIPPET_MAX_LINES) {
            throw new IllegalArgumentException(
                    fieldName + " must not exceed " + CODE_SNIPPET_MAX_LINES + " lines"
            );
        }
        return code;
    }

    public static String requireEnum(String value, String fieldName, String... allowedValues) {
        String normalized = requireText(value, fieldName).toUpperCase(Locale.ROOT);
        Set<String> allowed = Arrays.stream(allowedValues)
                .map(v -> v.toUpperCase(Locale.ROOT))
                .collect(Collectors.toSet());
        if (!allowed.contains(normalized)) {
            throw new IllegalArgumentException(fieldName + " must be one of: " + String.join(", ", allowedValues));
        }
        return normalized;
    }

    public static String optionalEnum(String value, String fieldName, String... allowedValues) {
        if (value == null || value.isBlank()) {
            return null;
        }
        return requireEnum(value, fieldName, allowedValues);
    }

    public static void validateRating(Integer rating, boolean required) {
        if (rating == null) {
            if (required) {
                throw new IllegalArgumentException("rating is required");
            }
            return;
        }
        if (rating < 0 || rating > 5) {
            throw new IllegalArgumentException("rating must be between 0 and 5");
        }
    }

    public static void validateScore(Double score, double min, double max) {
        if (score == null) {
            return;
        }
        if (score < min || score > max) {
            throw new IllegalArgumentException("score must be between " + min + " and " + max);
        }
    }

    public static void validateFile(
            MultipartFile file,
            String fieldName,
            long maxSizeMb,
            Set<String> allowedExtensions,
            Set<String> allowedContentTypes
    ) {
        if (file == null || file.isEmpty()) {
            throw new IllegalArgumentException(fieldName + " is required");
        }
        long maxBytes = maxSizeMb * 1024 * 1024;
        if (file.getSize() > maxBytes) {
            throw new IllegalArgumentException(fieldName + " exceeds max allowed size: " + maxSizeMb + " MB");
        }

        String originalName = file.getOriginalFilename();
        String extension = getExtension(originalName);
        if (!allowedExtensions.isEmpty() && !allowedExtensions.contains(extension)) {
            throw new IllegalArgumentException(fieldName + " must be one of: " + String.join(", ", allowedExtensions));
        }

        String contentType = file.getContentType();
        if (contentType != null && !contentType.isBlank() && !allowedContentTypes.isEmpty()) {
            String normalizedContentType = contentType.toLowerCase(Locale.ROOT);
            if (!allowedContentTypes.contains(normalizedContentType)) {
                throw new IllegalArgumentException(fieldName + " content type is not supported: " + contentType);
            }
        }
    }

    public static String getExtension(String filename) {
        if (filename == null || filename.isBlank() || !filename.contains(".")) {
            return "";
        }
        return filename.substring(filename.lastIndexOf('.') + 1).toLowerCase(Locale.ROOT);
    }

    public static boolean isPlaceholder(String value) {
        if (value == null || value.isBlank()) {
            return false;
        }
        String normalized = normalizePlaceholder(value);
        return PLACEHOLDER_VALUES.contains(normalized)
                || normalized.startsWith("paste_")
                || normalized.endsWith("_here");
    }

    public static void rejectPlaceholder(String value, String fieldName) {
        if (isPlaceholder(value)) {
            throw new IllegalArgumentException(fieldName + " must be a real value, not a placeholder");
        }
    }

    private static String normalizePlaceholder(String value) {
        String normalized = Normalizer.normalize(value.trim(), Normalizer.Form.NFD)
                .replaceAll("\\p{M}", "")
                .replace('đ', 'd')
                .replace('Đ', 'D')
                .toLowerCase(Locale.ROOT);
        return normalized.replaceAll("[^a-z0-9]+", "_").replaceAll("^_+|_+$", "");
    }
}