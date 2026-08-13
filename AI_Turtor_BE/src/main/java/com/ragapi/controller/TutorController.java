package com.ragapi.controller;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.ragapi.dto.AiQueryRequest;
import com.ragapi.dto.AiQueryResponse;
import com.ragapi.dto.CodeMentorRequest;
import com.ragapi.dto.CourseRagAnswer;
import com.ragapi.dto.IntentClassification;
import com.ragapi.dto.IntentClassifyRequest;
import com.ragapi.entity.QuestionEscalation;
import com.ragapi.entity.StudentCourseMemory;
import com.ragapi.service.AiConversationService;
import com.ragapi.service.CodeMentorService;
import com.ragapi.service.CourseRagService;
import com.ragapi.service.IntentClassifierService;
import com.ragapi.service.MentorEscalationService;
import com.ragapi.service.StudentCourseMemoryService;
import com.ragapi.service.StudentDailyQuestionQuotaService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.io.IOException;
import java.util.List;
import java.util.Map;

import static com.ragapi.util.ValidationUtils.DEFAULT_TEXT_MAX_LENGTH;
import static com.ragapi.util.ValidationUtils.requireMaxLength;
import static com.ragapi.util.ValidationUtils.requireText;

@Slf4j
@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
@Tag(name = "Tutor", description = "AI tutor query, intent routing and diagnostics APIs")
public class TutorController {

    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();
    private final CourseRagService ragService;
    private final MentorEscalationService mentorEscalationService;
    private final AiConversationService aiConversationService;
    private final StudentCourseMemoryService studentCourseMemoryService;
    private final CodeMentorService codeMentorService;
    private final IntentClassifierService intentClassifierService;
    private final StudentDailyQuestionQuotaService questionQuotaService;

    @PostMapping("/tutor/intent-classify")
    @Operation(summary = "Classify a student question for n8n AI Harness routing")
    public ResponseEntity<?> classifyIntent(@RequestBody IntentClassifyRequest request, Authentication authentication) {
        try {
            if (request == null) {
                return ResponseEntity.badRequest().body(Map.of("error", "request body is required"));
            }
            String question = request.getMessage() != null && !request.getMessage().isBlank()
                    ? request.getMessage()
                    : request.getQuestion();
            if (question == null || question.isBlank()) {
                return ResponseEntity.badRequest().body(Map.of("error", "message or question is required"));
            }
            String courseId = requireText(request.getCourseId(), "courseId");
            if (isStudent(authentication)) {
                questionQuotaService.consume(authentication.getName(), courseId);
            }

            IntentClassification intent = intentClassifierService.classify(
                    question,
                    request.getCodeSnippet(),
                    courseId
            );

            Map<String, Object> body = new java.util.LinkedHashMap<>();
            body.put("studentId", request.getStudentId() == null ? "" : request.getStudentId());
            body.put("courseId", request.getCourseId() == null ? "" : request.getCourseId());
            body.put("classId", request.getClassId() == null ? "" : request.getClassId());
            body.put("message", question);
            body.put("mode", intent.getMode());
            body.put("reason", intent.getReason());
            body.put("confidence", intent.getConfidence());
            body.put("subIntent", intent.getSubIntent());
            body.put("domain", intent.getDomain());
            body.put("answerPolicy", intent.getAnswerPolicy());
            body.put("requiresCourseMaterial", intent.getRequiresCourseMaterial());
            return ResponseEntity.ok(body);
        } catch (StudentDailyQuestionQuotaService.QuestionQuotaExceededException e) {
            String message = "Bạn đã dùng hết " + e.getDailyLimit() + " câu hỏi của môn "
                    + e.getCourseId() + " hôm nay. Bạn có thể hỏi môn khác hoặc quay lại vào ngày mai.";
            return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS).body(Map.of(
                    "error", message, "message", message,
                    "code", "DAILY_COURSE_QUESTION_LIMIT_REACHED", "courseId", e.getCourseId(),
                    "dailyLimit", e.getDailyLimit(), "remaining", 0, "resetAt", e.getResetAt().toString()
            ));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        } catch (Exception e) {
            log.error("Intent classification failed", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Server error: " + e.getMessage()));
        }
    }

    @PostMapping("/ai/query")
    @Operation(summary = "Ask the AI tutor using intent classification")
    public ResponseEntity<?> query(
            @RequestBody AiQueryRequest request,
            @RequestParam(value = "userId", required = false) String userId,
            @RequestParam(value = "userName", required = false) String userName,
            @RequestParam(value = "userEmail", required = false) String userEmail,
            Authentication authentication
    ) {
        try {
            if (request == null) {
                return ResponseEntity.badRequest().body(Map.of("error", "request body is required"));
            }
            String question = requireMaxLength(resolveQuestion(request), "question", DEFAULT_TEXT_MAX_LENGTH);
            String courseId = requireText(request.getCourseId(), "courseId");
            String classId = normalizeScopeValue(request.getClassId());
            if (isStudent(authentication) && !Boolean.TRUE.equals(request.getQuotaConsumed())) {
                questionQuotaService.consume(authentication.getName(), courseId);
            }
            IntentClassification intent = intentClassifierService.classify(
                    question,
                    request.getCodeSnippet(),
                    courseId
            );

            if (IntentClassifierService.MODE_CODE.equals(intent.getMode())) {
                return handleCodeMentorIntent(request, question, courseId, classId, userId, intent);
            }

            if (IntentClassifierService.MODE_ESCALATE.equals(intent.getMode())) {
                return handleEscalationIntent(question, courseId, classId, userId, userName, userEmail, intent);
            }

            if (isLearningCoachingIntent(question, courseId)) {
                return handleLearningCoachingIntent(request, question, courseId, classId, userId, intent);
            }

            CourseRagAnswer ragAnswer = ragService.askWithConfidence(
                    question,
                    courseId,
                    classId
            );
            String answer = ragAnswer.getAnswer();

            QuestionEscalation questionEscalation = null;
            String conversationId = null;
            String userMessageId = null;
            String assistantMessageId = null;

            if (userId != null && !userId.isBlank()) {
                if (courseId != null && !courseId.isBlank()) {
                    studentCourseMemoryService.recordInteraction(
                            userId,
                            courseId,
                            classId,
                            question,
                            answer
                    );
                }

                if (Boolean.TRUE.equals(ragAnswer.getEscalationRecommended())) {
                    questionEscalation = mentorEscalationService.createQuestionEscalation(
                            userId,
                            userEmail != null ? userEmail : "user@example.com",
                            userName != null ? userName : userId,
                            question,
                            answer,
                            courseId,
                            classId
                    );
                }

                var savedExchange = aiConversationService.saveExchangeWithMessages(
                        userId,
                        request.getConversationId(),
                        courseId,
                        classId,
                        question,
                        answer,
                        questionEscalation != null ? questionEscalation.getId() : null,
                        IntentClassifierService.MODE_RAG,
                        ragAnswer.getConfidence(),
                        ragAnswer.getSources(),
                        ragAnswer.getSourceEvidence(),
                        ragAnswer.getGroundingType()
                );
                conversationId = savedExchange.conversationId();
                userMessageId = savedExchange.userMessageId();
                assistantMessageId = savedExchange.assistantMessageId();
            }

            AiQueryResponse response = new AiQueryResponse();
            boolean escalated = questionEscalation != null;
            response.setMode(IntentClassifierService.MODE_RAG);
            response.setIntentReason(intent.getReason());
            response.setIntentConfidence(intent.getConfidence());
            applyIntentMetadata(response, intent);
            response.setAnswer(escalated ? ragAnswer.getAnswer() : answer);
            response.setConfidence(ragAnswer.getConfidence());
            response.setSources(ragAnswer.getSources());
            response.setSourceEvidence(ragAnswer.getSourceEvidence());
            response.setGroundingType(ragAnswer.getGroundingType());
            response.setEscalated(escalated);
            response.setEscalationReason(escalated ? ragAnswer.getEscalationReason() : null);
            response.setConversationId(conversationId);
            response.setUserMessageId(userMessageId);
            response.setAssistantMessageId(assistantMessageId);
            response.setCourseId(courseId);
            if (questionEscalation != null) {
                response.setQuestionEscalationId(questionEscalation.getId());
            }

            return ResponseEntity.ok(response);
        } catch (StudentDailyQuestionQuotaService.QuestionQuotaExceededException e) {
            return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS).body(Map.of(
                    "error", "Bạn đã dùng hết " + e.getDailyLimit() + " câu hỏi của môn "
                            + e.getCourseId() + " hôm nay. Bạn có thể hỏi môn khác hoặc quay lại vào ngày mai.",
                    "message", "Bạn đã dùng hết " + e.getDailyLimit() + " câu hỏi của môn "
                            + e.getCourseId() + " hôm nay. Bạn có thể hỏi môn khác hoặc quay lại vào ngày mai.",
                    "code", "DAILY_COURSE_QUESTION_LIMIT_REACHED",
                    "courseId", e.getCourseId(),
                    "dailyLimit", e.getDailyLimit(),
                    "remaining", 0,
                    "resetAt", e.getResetAt().toString()
            ));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        } catch (IOException e) {
            log.error("Course material search failed during AI query", e);
            AiQueryResponse response = new AiQueryResponse();
            response.setMode(IntentClassifierService.MODE_RAG);
            response.setAnswer("Hệ thống chưa truy cập được kho tài liệu môn học để AI Tutor trả lời chắc chắn. Câu hỏi cần được chuyển cho giáo viên/mentor phụ trách.");
            response.setConfidence(0.0);
            response.setSources(List.of());
            response.setEscalated(true);
            response.setEscalationReason("Course material search unavailable");
            response.setConversationId(request != null ? request.getConversationId() : null);

            try {
                if (request != null && userId != null && !userId.isBlank()
                        && request.getCourseId() != null && !request.getCourseId().isBlank()) {
                    QuestionEscalation escalation = mentorEscalationService.createQuestionEscalation(
                            userId,
                            userEmail != null ? userEmail : "user@example.com",
                            userName != null ? userName : userId,
                            resolveQuestion(request),
                            "Course material search unavailable.",
                            request.getCourseId(),
                            normalizeScopeValue(request.getClassId())
                    );
                    response.setQuestionEscalationId(escalation.getId());
                }
            } catch (Exception escalationError) {
                log.warn("Could not create escalation after course material search failure", escalationError);
            }

            return ResponseEntity.ok(response);
        } catch (Exception e) {
            log.error("Unexpected error during AI query", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Server error: " + e.getMessage()));
        }
    }

    private boolean isStudent(Authentication authentication) {
        return authentication != null && authentication.getAuthorities().stream()
                .anyMatch(authority -> "ROLE_STUDENT".equals(authority.getAuthority()));
    }

    private void applyIntentMetadata(AiQueryResponse response, IntentClassification intent) {
        if (response == null || intent == null) {
            return;
        }
        response.setSubIntent(intent.getSubIntent());
        response.setDomain(intent.getDomain());
        response.setAnswerPolicy(intent.getAnswerPolicy());
        response.setRequiresCourseMaterial(intent.getRequiresCourseMaterial());
    }

    private ResponseEntity<?> handleLearningCoachingIntent(
            AiQueryRequest request,
            String question,
            String courseId,
            String classId,
            String userId,
            IntentClassification intent
    ) {
        String answer = buildLearningCoachingAnswer(userId, courseId, classId);
        String conversationId = request.getConversationId();
        String userMessageId = null;
        String assistantMessageId = null;

        if (userId != null && !userId.isBlank()) {
            studentCourseMemoryService.recordInteraction(userId, courseId, classId, question, answer);
            var savedExchange = aiConversationService.saveExchangeWithMessages(
                    userId,
                    request.getConversationId(),
                    courseId,
                    classId,
                    question,
                    answer,
                    null
            );
            conversationId = savedExchange.conversationId();
            userMessageId = savedExchange.userMessageId();
            assistantMessageId = savedExchange.assistantMessageId();
        }

        AiQueryResponse response = new AiQueryResponse();
        response.setMode(IntentClassifierService.MODE_RAG);
        response.setIntentReason("Learning improvement coaching request");
        response.setIntentConfidence(intent.getConfidence());
        applyIntentMetadata(response, intent);
        response.setAnswer(answer);
        response.setConfidence(1.0);
        response.setSources(List.of("STUDENT_COURSE_MEMORY"));
        response.setEscalated(false);
        response.setEscalationReason(null);
        response.setConversationId(conversationId);
        response.setUserMessageId(userMessageId);
        response.setAssistantMessageId(assistantMessageId);
        response.setCourseId(courseId);
        return ResponseEntity.ok(response);
    }

    private String buildLearningCoachingAnswer(String userId, String courseId, String classId) {
        if (userId == null || userId.isBlank()) {
            return "Được, mình có thể giúp bạn cải thiện môn " + courseId + ". Nhưng để cá nhân hóa theo điểm yếu và lịch sử học, hệ thống cần biết studentId của bạn. Trước mắt, bạn có thể bắt đầu theo 3 bước: đọc lại tài liệu chính của môn, hỏi mình từng khái niệm chưa rõ, rồi làm bài tập nhỏ/paste lỗi code để Code Mentor hướng dẫn debug.";
        }

        StudentCourseMemory memory = studentCourseMemoryService.getOrCreateMemory(userId, courseId);
        List<String> weakTopics = memory.getWeakTopics() == null ? List.of() : memory.getWeakTopics();
        List<String> learnedTopics = memory.getLearnedTopics() == null ? List.of() : memory.getLearnedTopics();
        List<String> recentQuestions = memory.getRecentQuestions() == null ? List.of() : memory.getRecentQuestions();
        List<String> improveSuggestions = memory.getImproveSuggestions() == null ? List.of() : memory.getImproveSuggestions();

        StringBuilder answer = new StringBuilder();
        answer.append("Được, mình sẽ giúp bạn cải thiện môn ").append(courseId).append(" theo kiểu mentor nhé.\n\n");
        answer.append("## Tình trạng hiện tại\n");
        if (memory.getSummary() != null && !memory.getSummary().isBlank()) {
            answer.append("- ").append(memory.getSummary()).append("\n");
        } else {
            answer.append("- Hiện hệ thống chưa có nhiều dữ liệu học tập của bạn trong môn này. Mình sẽ bắt đầu bằng kế hoạch nền tảng.\n");
        }
        if (classId != null && !classId.isBlank()) {
            answer.append("- Lớp hiện tại: ").append(classId).append("\n");
        }

        answer.append("\n## Chủ đề nên ưu tiên\n");
        if (!weakTopics.isEmpty()) {
            for (String topic : weakTopics) {
                answer.append("- Ôn lại: ").append(topic).append("\n");
            }
        } else if (!recentQuestions.isEmpty()) {
            answer.append("- Mình chưa thấy weak topic rõ ràng, nhưng bạn đã hỏi gần đây về: ")
                    .append(String.join(", ", recentQuestions.subList(Math.max(0, recentQuestions.size() - Math.min(3, recentQuestions.size())), recentQuestions.size())))
                    .append("\n");
        } else {
            answer.append("- Chưa có điểm yếu được ghi nhận. Hãy bắt đầu bằng một chủ đề cụ thể bạn thấy khó, ví dụ OOP, array, loop, class/object hoặc exception.\n");
        }

        answer.append("\n## Kế hoạch cải thiện 3 bước\n");
        answer.append("1. Chọn 1 chủ đề nhỏ trong ").append(courseId).append(" và hỏi mình giải thích lại bằng ví dụ.\n");
        answer.append("2. Làm một bài tập nhỏ liên quan đến chủ đề đó, nếu lỗi thì paste code/lỗi vào Code Mentor.\n");
        answer.append("3. Sau khi hiểu, hỏi mình tóm tắt lại kiến thức và tự kiểm tra bằng 3 câu hỏi ngắn.\n");

        if (!learnedTopics.isEmpty()) {
            answer.append("\n## Chủ đề bạn đã học\n");
            for (String topic : learnedTopics) {
                answer.append("- ").append(topic).append("\n");
            }
        }

        if (!improveSuggestions.isEmpty()) {
            answer.append("\n## Gợi ý cải thiện đã có\n");
            for (String suggestion : improveSuggestions) {
                appendImproveSuggestion(answer, suggestion);
            }
        }

        answer.append("\nBạn muốn bắt đầu từ chủ đề nào trong ").append(courseId).append("? Nếu chưa biết, hãy gửi mình tên bài/slide hoặc paste đoạn code bạn đang kẹt.");
        return answer.toString();
    }

    private void appendImproveSuggestion(StringBuilder answer, String suggestion) {
        if (suggestion == null || suggestion.isBlank()) {
            return;
        }
        String trimmed = suggestion.trim();
        if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) {
            appendPlainImproveSuggestion(answer, trimmed);
            return;
        }
        try {
            JsonNode root = OBJECT_MAPPER.readTree(trimmed);
            appendJsonImproveSuggestion(answer, root);
        } catch (Exception e) {
            appendPlainImproveSuggestion(answer, trimmed);
        }
    }

    private void appendJsonImproveSuggestion(StringBuilder answer, JsonNode root) {
        JsonNode suggestions = root.has("suggestions") ? root.get("suggestions") : root;
        if (suggestions != null && suggestions.isArray()) {
            for (JsonNode item : suggestions) {
                String title = item.path("title").asText("").trim();
                String reason = item.path("reason").asText("").trim();
                if (!title.isBlank()) {
                    answer.append("- ").append(title).append("\n");
                }
                if (!reason.isBlank()) {
                    answer.append("  Lý do: ").append(reason).append("\n");
                }
                JsonNode nextSteps = item.path("nextSteps");
                if (nextSteps.isArray() && nextSteps.size() > 0) {
                    answer.append("  Việc nên làm:\n");
                    for (JsonNode step : nextSteps) {
                        String stepText = step.asText("").trim();
                        if (!stepText.isBlank()) {
                            answer.append("  - ").append(stepText).append("\n");
                        }
                    }
                }
            }
        }
        String notes = root.path("notes").asText("").trim();
        if (!notes.isBlank()) {
            answer.append("- Ghi chú: ").append(notes).append("\n");
        }
    }

    private void appendPlainImproveSuggestion(StringBuilder answer, String suggestion) {
        answer.append("- ").append(suggestion).append("\n");
    }
    private boolean isLearningCoachingIntent(String question, String courseId) {
        String text = question == null ? "" : question.toLowerCase();
        String course = courseId == null ? "" : courseId.toLowerCase();
        boolean asksImprove = text.contains("cải thiện")
                || text.contains("cai thien")
                || text.contains("học tốt")
                || text.contains("hoc tot")
                || text.contains("yếu")
                || text.contains("yeu")
                || text.contains("ôn tập")
                || text.contains("on tap")
                || text.contains("improve")
                || text.contains("lộ trình")
                || text.contains("lo trinh")
                || text.contains("kế hoạch")
                || text.contains("ke hoach");
        return asksImprove && (course.isBlank() || text.contains(course) || text.contains("môn") || text.contains("mon") || text.length() <= 120);
    }
    private ResponseEntity<?> handleCodeMentorIntent(
            AiQueryRequest request,
            String question,
            String courseId,
            String classId,
            String userId,
            IntentClassification intent
    ) {
        CodeMentorRequest codeRequest = new CodeMentorRequest();
        codeRequest.setStudentId(userId);
        codeRequest.setCourseId(courseId);
        codeRequest.setClassId(classId);
        codeRequest.setQuestion(question);
        codeRequest.setCode(request.getCodeSnippet());
        codeRequest.setConversationId(request.getConversationId());

        var codeResponse = codeMentorService.mentor(codeRequest);

        AiQueryResponse response = new AiQueryResponse();
        response.setMode(IntentClassifierService.MODE_CODE);
        response.setIntentReason(intent.getReason());
        response.setIntentConfidence(intent.getConfidence());
        applyIntentMetadata(response, intent);
        response.setAnswer(codeResponse.getAnswer());
        response.setConfidence(intent.getConfidence());
        response.setEscalated(false);
        response.setConversationId(codeResponse.getConversationId());
        response.setSources(List.of("CODE"));
        response.setSourceEvidence(List.of());
        response.setGroundingType(codeResponse.getGroundingType());
        return ResponseEntity.ok(response);
    }

    private ResponseEntity<?> handleEscalationIntent(
            String question,
            String courseId,
            String classId,
            String userId,
            String userName,
            String userEmail,
            IntentClassification intent
    ) {
        QuestionEscalation questionEscalation = null;
        if (userId != null && !userId.isBlank()) {
            questionEscalation = mentorEscalationService.createQuestionEscalation(
                    userId,
                    userEmail != null ? userEmail : "user@example.com",
                    userName != null ? userName : userId,
                    question,
                    "Intent classifier routed this question directly to teacher escalation.",
                    courseId,
                    classId
            );
        }

        AiQueryResponse response = new AiQueryResponse();
        response.setMode(IntentClassifierService.MODE_ESCALATE);
        response.setIntentReason(intent.getReason());
        response.setIntentConfidence(intent.getConfidence());
        applyIntentMetadata(response, intent);
        response.setAnswer(questionEscalation != null
                ? "Câu hỏi đã được gửi cho giáo viên/mentor phụ trách."
                : "Câu hỏi này cần giáo viên/mentor hỗ trợ. Vui lòng đăng nhập để tạo phiếu escalation.");
        response.setConfidence(intent.getConfidence());
        response.setEscalated(questionEscalation != null);
        response.setEscalationReason(intent.getReason());
        response.setQuestionEscalationId(questionEscalation != null ? questionEscalation.getId() : null);
        response.setSources(List.of());
        return ResponseEntity.ok(response);
    }

    private String resolveQuestion(AiQueryRequest request) {
        if (request.getMessage() != null && !request.getMessage().isBlank()) {
            return request.getMessage();
        }
        return request.getQuestion();
    }

    private String normalizeScopeValue(String value) {
        return value != null && !value.isBlank() ? value.trim() : null;
    }
}


