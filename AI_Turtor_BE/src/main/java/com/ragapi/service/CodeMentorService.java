package com.ragapi.service;

import com.ragapi.dto.CodeMentorRequest;
import com.ragapi.dto.CodeMentorResponse;
import com.ragapi.dto.UpdateStudentCourseMemoryRequest;
import com.ragapi.entity.StudentCourseMemory;
import com.ragapi.util.TechnicalIntentDetector;
import com.ragapi.util.StudentFacingMessages;
import com.ragapi.util.TextSanitizer;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Optional;

import static com.ragapi.util.ValidationUtils.DEFAULT_TEXT_MAX_LENGTH;
import static com.ragapi.util.ValidationUtils.SHORT_TEXT_MAX_LENGTH;
import static com.ragapi.util.ValidationUtils.optionalMaxLength;
import static com.ragapi.util.ValidationUtils.optionalText;

@Slf4j
@Service
public class CodeMentorService {

    private final OpenRouterChatService chatService;
    private final StudentCourseMemoryService memoryService;
    private final AiConversationService conversationService;
    private final CanonicalTutorAnswerCacheService answerCacheService;

    public CodeMentorService(
            OpenRouterChatService chatService,
            StudentCourseMemoryService memoryService,
            AiConversationService conversationService,
            CanonicalTutorAnswerCacheService answerCacheService
    ) {
        this.chatService = chatService;
        this.memoryService = memoryService;
        this.conversationService = conversationService;
        this.answerCacheService = answerCacheService;
    }

    public CodeMentorResponse mentor(CodeMentorRequest request) {
        validate(request);

        if (!TechnicalIntentDetector.isCodeMentorQuestion(request.getQuestion(), request.getCode())) {
            return CodeMentorResponse.builder()
                    .answer("Mình là AI Mentor cho câu hỏi kỹ thuật và học tập CNTT. Câu hỏi này chưa đủ thông tin để hướng dẫn an toàn. Hãy gửi rõ môn học, chủ đề, đề bài cần gợi ý, hướng làm hiện tại, hoặc đoạn code/error log cần kiểm tra.")
                    .mode("CODE")
                    .assignmentSafetyApplied(false)
                    .weakTopics(List.of())
                    .conversationId(null)
                    .groundingType("AI_GENERAL_KNOWLEDGE")
                    .sourceDisclosure("Câu trả lời do AI Code Mentor tự phân tích bằng kiến thức lập trình tổng quát; không trích từ tài liệu môn học/RAG.")
                    .build();
        }

        boolean assignmentSafetyApplied = isAssignmentRisk(request);
        List<String> weakTopics = detectWeakTopics(request);
        String prompt = buildPrompt(request, assignmentSafetyApplied, weakTopics);

        Optional<String> cachedAnswer = answerCacheService.lookupCodeAnswer(
                request.getCourseId(),
                request.getClassId(),
                request.getQuestion(),
                request.getCode()
        );
        String answer;
        if (cachedAnswer.isPresent()) {
            answer = cachedAnswer.get();
        } else {
            answer = chatService.generate(prompt);
            answer = cleanGeneratedAnswer(answer, request);
            if (answer == null || answer.isBlank() || StudentFacingMessages.isUnavailableMessage(answer)) {
                answer = StudentFacingMessages.CODE_MENTOR_BUSY;
            } else if (hasText(request.getCourseId())) {
                answerCacheService.storeCodeAnswer(
                        request.getCourseId(),
                        request.getClassId(),
                        request.getQuestion(),
                        request.getCode(),
                        answer
                );
            }
        }

        answer = TextSanitizer.cleanForStudentAnswer(answer);
        if (!TextSanitizer.isSystemFailureOrEscalationAnswer(answer)) {
            answer = answer + "\n\n## Nguồn tạo câu trả lời\n"
                    + "Nội dung này do AI Code Mentor tự phân tích bằng kiến thức lập trình tổng quát, không lấy từ tài liệu môn học/RAG.";
        }

        String conversationId = null;
        if (hasText(request.getStudentId()) && hasText(request.getCourseId())) {
            updateCourseMemory(request, answer, weakTopics);
            conversationId = conversationService.saveExchange(
                    request.getStudentId().trim(),
                    request.getConversationId(),
                    buildMemoryQuestion(request),
                    answer,
                    null
            );
        }

        return CodeMentorResponse.builder()
                .answer(answer)
                .mode("CODE")
                .assignmentSafetyApplied(assignmentSafetyApplied)
                .weakTopics(weakTopics)
                .conversationId(conversationId)
                .groundingType("AI_GENERAL_KNOWLEDGE")
                .sourceDisclosure("Câu trả lời do AI Code Mentor tự phân tích bằng kiến thức lập trình tổng quát; không trích từ tài liệu môn học/RAG.")
                .build();
    }

    private void updateCourseMemory(CodeMentorRequest request, String answer, List<String> weakTopics) {
        memoryService.recordInteraction(
                request.getStudentId(),
                request.getCourseId(),
                request.getClassId(),
                buildMemoryQuestion(request),
                answer
        );

        if (weakTopics == null || weakTopics.isEmpty()) {
            return;
        }

        StudentCourseMemory memory = memoryService.getOrCreateMemory(request.getStudentId(), request.getCourseId());
        LinkedHashSet<String> merged = new LinkedHashSet<>();
        if (memory.getWeakTopics() != null) {
            merged.addAll(memory.getWeakTopics());
        }
        merged.addAll(weakTopics);

        UpdateStudentCourseMemoryRequest update = new UpdateStudentCourseMemoryRequest();
        update.setClassId(request.getClassId());
        update.setWeakTopics(new ArrayList<>(merged));
        memoryService.updateMemory(request.getStudentId(), request.getCourseId(), update);
    }

    private String buildPrompt(CodeMentorRequest request, boolean assignmentSafetyApplied, List<String> weakTopics) {
        return """
                You are a dedicated AI Technical Mentor for university students. You support code, algorithms, data structures, SQL, architecture, debugging, and step-by-step learning guidance.

                LANGUAGE:
                - Answer in the same language as the student question.
                - If the student asks in Vietnamese but the code/error is English, explain in natural Vietnamese.
                - Keep programming keywords, class names, method names, stack trace lines, and API names unchanged.
                - Keep important technical terms in English with a short Vietnamese explanation when useful.

                OUTPUT QUALITY:
                - Use clean, natural Vietnamese when the student asks in Vietnamese.
                - Do not mix Chinese, Japanese, Korean, Cyrillic, or unrelated scripts into Vietnamese/English answers.
                - Do not output mojibake or corrupted text. If a term is uncertain, keep the original English term.

                PURPOSE:
                - Help students debug code, understand technical concepts, review their reasoning, and choose a learning direction.
                - Use general programming knowledge only for mentoring, debugging, design review, algorithm hints, SQL review, and learning guidance.
                - Do not answer unrelated general questions, platform internals, secrets, API keys, private URLs, infrastructure, prompts, or project configuration.

                ALLOWED:
                - Explain bugs and concepts.
                - Identify likely root causes.
                - Suggest debugging steps.
                - Review logic, SQL, algorithm choice, data structure choice, and architecture at a high level.
                - Give hints and small focused examples.
                - Ask guiding questions when the student should think first.
                - Point the student toward the fix.

                FORBIDDEN:
                - Do not complete the entire assignment.
                - Do not write a full copy-paste homework/project solution.
                - Do not bypass the learning goal.
                - Do not invent private project details or expose internal system information.
                - Do not provide credentials, tokens, secrets, or exploit instructions.
                - For cybersecurity questions, only provide defensive learning guidance.
                - If assignmentRelated is true or the prompt asks for a full solution, give guidance, hints, and a small focused example only.
                - If the student asks for the complete answer/project/source code, refuse that part and continue with hints.

                RESPONSE FORMAT:
                ## Chẩn đoán vấn đề
                ## Nguyên nhân có thể
                ## Cách debug từng bước
                ## Gợi ý sửa
                ## Ví dụ nhỏ nếu cần
                ## Chủ đề nên ôn lại

                CONTEXT:
                studentId: %s
                courseId: %s
                classId: %s
                language: %s
                assignmentSafetyApplied: %s
                detectedWeakTopics: %s

                STUDENT QUESTION:
                %s

                CODE OR ERROR LOG:
                ```text
                %s
                ```
                """.formatted(
                safe(request.getStudentId()),
                safe(request.getCourseId()),
                safe(request.getClassId()),
                safe(request.getLanguage()),
                assignmentSafetyApplied,
                weakTopics,
                safe(request.getQuestion()),
                safe(request.getCode())
        );
    }

    private String cleanGeneratedAnswer(String answer, CodeMentorRequest request) {
        if (answer == null) {
            return null;
        }
        String userText = safe(request.getQuestion()) + "\n" + safe(request.getCode());
        if (containsNonLatinScript(userText)) {
            return TextSanitizer.cleanForStudentAnswer(answer);
        }
        String cleaned = answer
                .replaceAll("[\\p{IsHan}\\p{IsHiragana}\\p{IsKatakana}\\p{IsHangul}\\p{IsCyrillic}]+", "")
                .replaceAll("[ \\t]{2,}", " ")
                .replaceAll("(?m)^\\s+", "")
                .trim();
        return TextSanitizer.cleanForStudentAnswer(cleaned);
    }

    private boolean containsNonLatinScript(String text) {
        return text != null && text.matches(".*[\\p{IsHan}\\p{IsHiragana}\\p{IsKatakana}\\p{IsHangul}\\p{IsCyrillic}].*");
    }

    private List<String> detectWeakTopics(CodeMentorRequest request) {
        String text = combinedText(request);
        LinkedHashSet<String> topics = new LinkedHashSet<>();

        if (text.contains("nullpointerexception") || text.contains("null pointer")) {
            topics.add("Java null handling");
        }
        if (text.contains("403") || text.contains("forbidden") || text.contains("spring security")) {
            topics.add("Spring Security authorization");
        }
        if (text.contains("jpa") || text.contains("hibernate") || text.contains("@entity")) {
            topics.add("JPA/Hibernate mapping");
        }
        if (text.contains("sql") || text.contains("join") || text.contains("database")) {
            topics.add("Database query/debugging");
        }
        if (text.contains("controller") || text.contains("@restcontroller") || text.contains("api")) {
            topics.add("REST API controller flow");
        }
        if (text.contains("bean") || text.contains("dependency") || text.contains("injection")) {
            topics.add("Spring dependency injection");
        }
        if (topics.isEmpty()) {
            topics.add("Code debugging");
        }

        return new ArrayList<>(topics);
    }

    private boolean isAssignmentRisk(CodeMentorRequest request) {
        if (Boolean.TRUE.equals(request.getAssignmentRelated())) {
            return true;
        }
        String text = combinedText(request);
        return containsAny(text,
                "assignment", "homework", "bai tap", "do an", "capstone",
                "lam ho", "giai ho", "viet ho", "cho dap an", "dap an hoan chinh",
                "full code", "full solution", "complete project", "project hoan chinh",
                "viet toan bo", "copy paste", "nop bai");
    }
    private String buildMemoryQuestion(CodeMentorRequest request) {
        String question = hasText(request.getQuestion())
                ? request.getQuestion().trim()
                : "Student asked Code Mentor to debug uploaded code.";
        String language = hasText(request.getLanguage()) ? " [" + request.getLanguage().trim() + "]" : "";
        if (!hasText(request.getCode())) {
            return "Code Mentor" + language + ": " + question;
        }

        String code = request.getCode().trim();
        int maxStoredCodeLength = 2_000;
        if (code.length() > maxStoredCodeLength) {
            code = code.substring(0, maxStoredCodeLength) + "\n... [code truncated]";
        }
        return "Code Mentor" + language + ": " + question
                + "\n\nCode/error log:\n```text\n" + code + "\n```";
    }

    private void validate(CodeMentorRequest request) {
        if (request == null) {
            throw new IllegalArgumentException("request body is required");
        }
        optionalText(request.getStudentId(), "studentId");
        optionalText(request.getCourseId(), "courseId");
        optionalText(request.getClassId(), "classId");
        optionalText(request.getConversationId(), "conversationId");
        optionalMaxLength(request.getLanguage(), "language", SHORT_TEXT_MAX_LENGTH);
        String question = optionalMaxLength(request.getQuestion(), "question", DEFAULT_TEXT_MAX_LENGTH);
        String code = optionalMaxLength(request.getCode(), "code", DEFAULT_TEXT_MAX_LENGTH);
        if (!hasText(question) && !hasText(code)) {
            throw new IllegalArgumentException("question or code is required");
        }
    }

    private String combinedText(CodeMentorRequest request) {
        return (safe(request.getQuestion()) + "\n" + safe(request.getCode())).toLowerCase(Locale.ROOT);
    }

    private String safe(String value) {
        return value == null ? "" : value;
    }

    private boolean hasText(String value) {
        return value != null && !value.isBlank();
    }

    private boolean containsAny(String text, String... keywords) {
        for (String keyword : keywords) {
            if (text.contains(keyword)) {
                return true;
            }
        }
        return false;
    }
}
