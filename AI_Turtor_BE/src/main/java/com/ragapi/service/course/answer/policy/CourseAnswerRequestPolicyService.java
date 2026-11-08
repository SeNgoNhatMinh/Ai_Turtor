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
        boolean namesCredential = normalized.contains("api key")
                || normalized.contains("apikey")
                || normalized.contains("password")
                || normalized.contains("mat khau")
                || normalized.contains("database uri")
                || normalized.contains("mongodb uri")
                || normalized.contains("token")
                || normalized.contains("secret")
                || normalized.contains("openrouter");
        boolean credentialRequest = namesCredential
                && (internalTarget || asksToObtainSecret(normalized));

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
        if (!StudentChatIntentDetector.isAllowedInteraction(question)
                || StudentChatIntentDetector.isGreeting(question)) {
            return null;
        }

        return buildCasualRedirect(courseId);
    }

    public CourseRagAnswer buildStudyStartGuidance(String answer) {
        if (answer == null || answer.isBlank()) {
            return null;
        }
        return safeConversationAnswer(answer);
    }

    public CourseRagAnswer buildOffTopicRedirect(String question, String courseId) {
        if (!StudentChatIntentDetector.shouldBlockExternalLlm(question)) {
            return null;
        }
        if (StudentChatIntentDetector.isIncompleteOrMeaningless(question)) {
            return safeConversationAnswer(
                    "Câu hỏi của bạn chưa hoàn chỉnh hoặc chưa có nội dung học tập cụ thể. "
                            + "Hãy nhập đầy đủ chủ đề hoặc câu hỏi trong môn " + courseId
                            + ", ví dụ: \"Giải thích khái niệm ...\" hoặc \"... hoạt động như thế nào?\""
            );
        }
        if (StudentChatIntentDetector.isCasualNonAcademic(question)) {
            return buildCasualRedirect(courseId);
        }
        return safeConversationAnswer(
                "Mình là AI Tutor môn " + courseId + ", chỉ hỗ trợ câu hỏi học thuật và nội dung tài liệu môn học. "
                        + "Mình không sử dụng API AI bên ngoài cho câu hỏi ngoài phạm vi học tập. "
                        + "Với lịch học, phòng học, điểm số hoặc thông tin lớp, bạn hãy xem trên hệ thống lớp hoặc hỏi giáo viên/mentor phụ trách."
        );
    }

    public CourseRagAnswer buildCasualRedirect(String courseId) {
        return safeConversationAnswer(
                "Mình chỉ nhận câu hỏi học thuật của môn " + courseId
                        + ": khái niệm, bài học, hoặc lỗi code trong môn. "
                        + "Mình không nói chuyện phiếm và không trả lời câu ngoài bài học."
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

    private boolean asksToObtainSecret(String normalized) {
        return normalized.contains("cho minh")
                || normalized.contains("cho toi")
                || normalized.contains("gui cho")
                || normalized.contains("cua ban")
                || normalized.contains("cua he thong")
                || normalized.contains("trong env")
                || normalized.contains("file env")
                || normalized.contains("reveal")
                || normalized.contains("show me")
                || normalized.contains("in ra")
                || normalized.contains("lay key")
                || normalized.contains("dua key")
                || normalized.contains("cung cap key")
                || normalized.contains("key that")
                || normalized.contains("real api");
    }

    private String normalizeForMatch(String text) {
        return TextSanitizer.normalizeAccentInsensitive(text);
    }
}
