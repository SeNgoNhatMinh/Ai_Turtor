package com.ragapi.service.course.answer.policy;

import com.ragapi.dto.CourseRagAnswer;
import com.ragapi.util.StudentChatIntentDetector;
import com.ragapi.util.TextSanitizer;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class CourseAnswerRequestPolicyService {

    public CourseRagAnswer buildSensitiveInternalAnswer(String question) {
        String normalized = normalizeForMatch(question);
        if (normalized.isBlank()) {
            return null;
        }

        boolean internalTarget = normalized.contains("he thong")
                || normalized.contains("noi bo")
                || normalized.contains("nen tang ai tutor")
                || normalized.contains("du an nay")
                || normalized.contains("project nay")
                || normalized.contains("server cua he thong")
                || normalized.contains("file env")
                || normalized.contains("bien moi truong cua he thong");
        boolean internalSourceRequest = (normalized.contains("ma nguon")
                || normalized.contains("source code")
                || normalized.contains("project source"))
                && internalTarget;
        boolean internalConfigRequest = (normalized.contains("config")
                || normalized.contains("cau hinh"))
                && internalTarget
                && !StudentChatIntentDetector.isLessonStart(question);
        boolean credentialRequest = normalized.contains("api key")
                || normalized.contains("apikey")
                || normalized.contains("password")
                || normalized.contains("mat khau")
                || normalized.contains("database uri")
                || normalized.contains("mongodb uri")
                || ((normalized.contains("token")
                || normalized.contains("secret")
                || normalized.contains("openrouter")) && internalTarget);

        if (!credentialRequest && !internalSourceRequest && !internalConfigRequest) {
            return null;
        }

        return safeConversationAnswer(
                "Mình không thể cung cấp mã nguồn, API key, token, cấu hình nội bộ hoặc thông tin nhạy cảm của hệ thống. "
                        + "Nếu bạn cần hỗ trợ học tập, hãy hỏi về nội dung môn học hoặc gửi đoạn code/lỗi cần được mentor hướng dẫn debug."
        );
    }

    public boolean isUnderstandingRemediation(String question) {
        return question != null
                && question.stripLeading().startsWith("Ôn lại sau câu ");
    }

    public boolean isGuidedLessonMode(String teachingMode) {
        return "LEARNING_PATH".equalsIgnoreCase(teachingMode)
                || "LESSON_TEACH".equalsIgnoreCase(teachingMode)
                || "LESSON_DEEP_PATH".equalsIgnoreCase(teachingMode);
    }

    public CourseRagAnswer buildConversationalAnswer(String question, String courseId) {
        if (!StudentChatIntentDetector.isAllowedInteraction(question)) {
            return null;
        }

        String normalized = normalizeForMatch(question);
        if (isGreeting(normalized)) {
            return safeConversationAnswer(
                    "Chào bạn, mình là AI Tutor của môn " + courseId
                            + ". Bạn có thể hỏi mình về tài liệu môn học, khái niệm lý thuyết, hoặc paste code/lỗi để Code Mentor hỗ trợ debug."
            );
        }
        if (isThanks(normalized)) {
            return safeConversationAnswer(
                    "Không có gì. Nếu còn phần nào chưa rõ trong môn " + courseId + ", bạn cứ hỏi tiếp nhé."
            );
        }
        if (isGoodbye(normalized)) {
            return safeConversationAnswer(
                    "Tạm biệt nhé. Khi cần ôn bài hoặc debug code, bạn quay lại hỏi mình tiếp."
            );
        }
        if (isCapabilityQuestion(normalized)) {
            return safeConversationAnswer(
                    "Mình là AI Tutor của bạn trong môn " + courseId
                            + ". Bạn có thể hỏi mình theo kiểu rất tự nhiên, ví dụ: \"JPA là gì?\", \"giải thích MVC giúp mình\", "
                            + "hoặc paste lỗi/code để mình hướng dẫn debug như một mentor. Nếu tài liệu môn học chưa có nội dung phù hợp, "
                            + "mình sẽ nói rõ và chuyển câu hỏi cho giáo viên/mentor thay vì tự bịa."
            );
        }
        if (isHowToUseQuestion(normalized)) {
            return safeConversationAnswer(
                    "Bạn cứ hỏi như đang hỏi mentor nhé. Nếu hỏi lý thuyết, mình sẽ dựa vào tài liệu của môn " + courseId
                            + ". Nếu hỏi code, bạn paste đoạn code hoặc lỗi vào Code Mentor. Nếu câu hỏi cần giáo viên xác nhận, "
                            + "ví dụ deadline, điểm số hoặc quy định lớp, mình sẽ tạo escalation cho mentor phụ trách."
            );
        }
        return null;
    }

    public CourseRagAnswer buildOffTopicRedirect(String question, String courseId) {
        if (!StudentChatIntentDetector.isOffTopicNonAcademic(question)) {
            return null;
        }
        return safeConversationAnswer(
                "Mình là AI Tutor môn " + courseId + ", chỉ hỗ trợ câu hỏi học thuật và nội dung tài liệu môn học. "
                        + "Câu hỏi về lịch học, giờ học, phòng học, điểm số hoặc thông tin hành chính bạn nên xem trên hệ thống lớp hoặc hỏi giáo viên/mentor phụ trách."
        );
    }

    public boolean asksForUnsupportedExpansion(String question, String context) {
        String normalizedQuestion = normalizeForMatch(question);
        if (normalizedQuestion.isBlank()) {
            return false;
        }

        boolean asksForRealProject = normalizedQuestion.contains("du an thuc te")
                || normalizedQuestion.contains("dự án thực tế")
                || normalizedQuestion.contains("project thuc te")
                || normalizedQuestion.contains("real project")
                || normalizedQuestion.contains("project hoan chinh")
                || normalizedQuestion.contains("dự án hoàn chỉnh")
                || normalizedQuestion.contains("full project")
                || normalizedQuestion.contains("bai lam hoan chinh")
                || normalizedQuestion.contains("bài làm hoàn chỉnh")
                || normalizedQuestion.contains("dap an hoan chinh")
                || normalizedQuestion.contains("đáp án hoàn chỉnh");
        if (!asksForRealProject) {
            return false;
        }

        String normalizedContext = normalizeForMatch(context);
        int supportSignals = 0;
        if (normalizedContext.contains("du an thuc te")
                || normalizedContext.contains("dự án thực tế")
                || normalizedContext.contains("real project")) {
            supportSignals++;
        }
        if (normalizedContext.contains("yeu cau du an")
                || normalizedContext.contains("yêu cầu dự án")
                || normalizedContext.contains("project requirement")) {
            supportSignals++;
        }
        if (normalizedContext.contains("rubric")
                || normalizedContext.contains("tieu chi cham")
                || normalizedContext.contains("tiêu chí chấm")) {
            supportSignals++;
        }
        return supportSignals < 2;
    }

    private CourseRagAnswer safeConversationAnswer(String answer) {
        return CourseRagAnswer.builder()
                .answer(answer)
                .confidence(1.0)
                .sources(List.of())
                .sourceEvidence(List.of())
                .groundingType("NONE")
                .escalationRecommended(false)
                .escalationReason(null)
                .build();
    }

    private boolean isGreeting(String value) {
        return value.equals("hi") || value.equals("hello") || value.equals("hey")
                || value.equals("xin chao") || value.equals("xin chào")
                || value.equals("chao") || value.equals("chào")
                || value.equals("chao ban") || value.equals("chào bạn")
                || value.equals("hi ai") || value.equals("hello ai");
    }

    private boolean isThanks(String value) {
        return value.equals("cam on") || value.equals("cảm ơn")
                || value.equals("thank") || value.equals("thanks")
                || value.equals("thank you") || value.equals("ok thanks");
    }

    private boolean isGoodbye(String value) {
        return value.equals("bye") || value.equals("goodbye")
                || value.equals("tam biet") || value.equals("tạm biệt");
    }

    private boolean isCapabilityQuestion(String value) {
        return value.equals("ban la ai") || value.equals("bạn là ai")
                || value.equals("ban lam duoc gi") || value.equals("bạn làm được gì")
                || value.equals("ai tutor la gi") || value.equals("ai tutor là gì")
                || value.equals("help") || value.equals("tro giup") || value.equals("trợ giúp");
    }

    private boolean isHowToUseQuestion(String value) {
        return value.contains("hoi nhu the nao") || value.contains("hỏi như thế nào")
                || value.contains("cach dung") || value.contains("cách dùng")
                || value.contains("su dung nhu the nao") || value.contains("sử dụng như thế nào")
                || value.contains("toi nen hoi gi") || value.contains("tôi nên hỏi gì")
                || value.contains("minh nen hoi gi") || value.contains("mình nên hỏi gì");
    }

    private String normalizeForMatch(String text) {
        return TextSanitizer.normalizeAccentInsensitive(text);
    }
}
