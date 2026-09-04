package com.ragapi.util;

import java.util.Locale;

/**
 * Student-safe wording. Never expose LLM, quota, connection, provider, or infra details.
 */
public final class StudentFacingMessages {

    public static final String GENERATION_BUSY =
            "Mình chưa soạn xong ý này từ tài liệu. Bạn bấm Thử lại giúp mình, hoặc hỏi gọn hơn một ý nhé.";

    public static final String GENERATION_UNAVAILABLE =
            "Mình chưa giảng được phần này lúc này. Bạn thử lại giúp mình, hoặc gửi mentor nếu cần gấp nhé.";

    public static final String RAG_EMPTY =
            "Mình chưa tổng hợp được câu trả lời từ tài liệu môn học cho câu hỏi này. Bạn thử diễn đạt lại câu hỏi, hoặc hỏi mentor nếu vẫn chưa rõ nhé.";

    public static final String CODE_MENTOR_BUSY =
            "Mình chưa phân tích xong phần này. Bạn thử gửi lại đoạn code hoặc lỗi cụ thể hơn, hoặc thử lại sau vài giây nhé.";

    public static String dailySessionComplete(String courseId) {
        String course = courseId == null || courseId.isBlank() ? "môn này" : "môn " + courseId.trim();
        return "Phiên học hôm nay của " + course
                + " đã hết. Cảm ơn bạn đã học cùng mình. Bạn có thể hỏi môn khác, hoặc quay lại vào ngày mai.";
    }

    private StudentFacingMessages() {
    }

    public static boolean isUnavailableMessage(String value) {
        if (value == null || value.isBlank()) {
            return true;
        }
        String normalized = TextSanitizer.normalizeAccentInsensitive(value);
        return looksLikeUnavailable(normalized);
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

    private static boolean looksLikeUnavailable(String normalized) {
        String text = normalize(normalized);
        return text.equals(normalize(GENERATION_BUSY))
                || text.equals(normalize(GENERATION_UNAVAILABLE))
                || text.equals(normalize(RAG_EMPTY))
                || text.equals(normalize(CODE_MENTOR_BUSY))
                || text.contains("chua soan xong")
                || text.contains("xu ly hoi cham")
                || text.contains("chua tao duoc cau tra loi")
                || text.contains("chua giang duoc phan nay")
                || text.contains("chua phan tich xong");
    }

    private static String normalize(String value) {
        return TextSanitizer.normalizeAccentInsensitive(value).toLowerCase(Locale.ROOT);
    }
}
