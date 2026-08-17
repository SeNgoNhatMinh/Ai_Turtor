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

    private static String normalize(String value) {
        return TextSanitizer.normalizeAccentInsensitive(value).toLowerCase(Locale.ROOT);
    }
}
