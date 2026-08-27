package com.ragapi.util;

import java.util.Locale;

/**
 * Student-safe wording. Never expose LLM, quota, connection, provider, or infra details.
 */
public final class StudentFacingMessages {

    public static final String GENERATION_BUSY =
            "Mình đang xử lý hơi chậm một chút. Bạn thử hỏi lại sau vài giây, hoặc chia nhỏ câu hỏi để mình trả lời chính xác hơn nhé.";

    public static final String GENERATION_UNAVAILABLE =
            "Hiện tại mình chưa tạo được câu trả lời cho câu hỏi này. Bạn thử hỏi lại sau ít phút, hoặc nhờ mentor hỗ trợ nếu cần gấp nhé.";

    public static final String RAG_EMPTY =
            "Mình chưa tổng hợp được câu trả lời từ tài liệu môn học cho câu hỏi này. Bạn thử diễn đạt lại câu hỏi, hoặc hỏi mentor nếu vẫn chưa rõ nhé.";

    public static final String CODE_MENTOR_BUSY =
            "Mình chưa phân tích xong phần này. Bạn thử gửi lại đoạn code hoặc lỗi cụ thể hơn, hoặc thử lại sau vài giây nhé.";

    private StudentFacingMessages() {
    }

    public static boolean isUnavailableMessage(String value) {
        if (value == null || value.isBlank()) {
            return true;
        }
        String normalized = TextSanitizer.normalizeAccentInsensitive(value);
        return normalized.equals(normalize(GENERATION_BUSY))
                || normalized.equals(normalize(GENERATION_UNAVAILABLE))
                || normalized.equals(normalize(RAG_EMPTY))
                || normalized.equals(normalize(CODE_MENTOR_BUSY));
    }

    /**
     * LLM refusals that say the textbook omitted a topic. Do not cache or reuse them
     * after Senior-approved knowledge has been indexed for that course.
     */
    public static boolean isInsufficientMaterialAnswer(String value) {
        if (value == null || value.isBlank()) {
            return false;
        }
        String normalized = normalize(value);
        boolean mentionsMaterial = normalized.contains("tai lieu")
                || normalized.contains("course material")
                || normalized.contains("materialid");
        boolean saysMissing = normalized.contains("khong de cap")
                || normalized.contains("khong nhac")
                || normalized.contains("does not mention")
                || normalized.contains("not mentioned");
        return mentionsMaterial && saysMissing;
    }

    private static String normalize(String value) {
        return TextSanitizer.normalizeAccentInsensitive(value).toLowerCase(Locale.ROOT);
    }
}
