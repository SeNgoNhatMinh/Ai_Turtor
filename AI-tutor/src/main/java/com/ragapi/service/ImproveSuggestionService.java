package com.ragapi.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.ragapi.dto.SuggestionItem;
import com.ragapi.dto.SuggestionRequest;
import com.ragapi.dto.SuggestionResponse;
import com.ragapi.dto.UpdateStudentCourseMemoryRequest;
import com.ragapi.entity.StudentCourseMemory;
import com.ragapi.util.TextSanitizer;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Slf4j
@Service
@RequiredArgsConstructor
public class ImproveSuggestionService {

    private final StudentCourseMemoryService memoryService;
    private final OpenRouterChatService chatService;
    private final ImprovePlanService improvePlanService;
    private final ObjectMapper objectMapper = new ObjectMapper();

    public SuggestionResponse buildSuggestions(SuggestionRequest request) {
        String studentId = resolveStudentId(request);
        String courseId = request.getCourseId();

        if (studentId == null || studentId.isBlank()) {
            throw new IllegalArgumentException("studentId is required");
        }
        if (courseId == null || courseId.isBlank()) {
            throw new IllegalArgumentException("courseId is required");
        }
        if (request.getRequesterUserId() != null && !request.getRequesterUserId().equals(studentId)) {
            throw new IllegalArgumentException("requesterUserId invalid");
        }

        StudentCourseMemory memory = memoryService.getOrCreateMemory(studentId, courseId);
        if (request.getClassId() != null && !request.getClassId().isBlank()) {
            UpdateStudentCourseMemoryRequest update = new UpdateStudentCourseMemoryRequest();
            update.setClassId(request.getClassId());
            memory = memoryService.updateMemory(studentId, courseId, update);
        }
        if (request.getQuestion() != null && !request.getQuestion().isBlank()) {
            memory = memoryService.recordInteraction(studentId, courseId, request.getClassId(), request.getQuestion(), null);
        }

        improvePlanService.generateOrUpdatePlan(memory, "IMPROVE_ENGINE");

        List<SuggestionItem> ruleSuggestions = buildRuleSuggestions(memory);
        String aiSuggestion = null;
        if (Boolean.TRUE.equals(request.getIncludeAiSuggestion())) {
            aiSuggestion = buildAiSuggestion(request, memory);
        }

        return new SuggestionResponse(
                studentId,
                courseId,
                studentId,
                null,
                TextSanitizer.clean(memory.getSummary()),
                sanitizeSuggestionItems(ruleSuggestions),
                TextSanitizer.clean(aiSuggestion)
        );
    }

    private List<SuggestionItem> buildRuleSuggestions(StudentCourseMemory memory) {
        List<SuggestionItem> suggestions = new ArrayList<>();

        if (memory.getWeakTopics() != null && !memory.getWeakTopics().isEmpty()) {
            List<String> weakTopics = TextSanitizer.cleanList(memory.getWeakTopics());
            suggestions.add(new SuggestionItem(
                    "Ôn lại chủ đề còn yếu",
                    "Memory của môn học ghi nhận bạn đang yếu: " + String.join(", ", weakTopics),
                    weakTopics.stream()
                            .map(topic -> "Ôn lại " + topic + " và làm một bài thực hành nhỏ")
                            .toList(),
                    "RULE"
            ));
        }

        if (memory.getRecentQuestions() != null && memory.getRecentQuestions().size() >= 3) {
            suggestions.add(new SuggestionItem(
                    "Tóm tắt các câu hỏi gần đây",
                    "Bạn đã hỏi nhiều câu trong môn này, nên gom lại theo chủ đề để ôn tập.",
                    List.of(
                            "Nhóm các câu hỏi gần đây theo chủ đề",
                            "Nhờ AI Tutor tạo checklist ôn tập ngắn",
                            "Xem lại tài liệu môn học ở các phần bị hỏi lặp lại"
                    ),
                    "RULE"
            ));
        }

        if (memory.getImproveSuggestions() != null && !memory.getImproveSuggestions().isEmpty()) {
            suggestions.add(new SuggestionItem(
                    "Làm theo gợi ý cải thiện",
                    "Môn học này đã có gợi ý cải thiện hoặc phản hồi trước đó.",
                    TextSanitizer.cleanList(memory.getImproveSuggestions()),
                    "RULE"
            ));
        }

        if (suggestions.isEmpty()) {
            suggestions.add(new SuggestionItem(
                    "Duy trì nhịp học ổn định",
                    "Hiện chưa có chủ đề yếu rõ ràng trong môn này.",
                    List.of(
                            "Hỏi AI Tutor khi có khái niệm chưa rõ",
                            "Ôn lại tài liệu môn học đã được upload",
                            "Làm bài tập đúng hạn và xem phản hồi của mentor"
                    ),
                    "RULE"
            ));
        }

        return sanitizeSuggestionItems(suggestions);
    }
    private List<SuggestionItem> sanitizeSuggestionItems(List<SuggestionItem> suggestions) {
        if (suggestions == null) {
            return List.of();
        }
        return suggestions.stream()
                .map(item -> new SuggestionItem(
                        TextSanitizer.clean(item.getTitle()),
                        TextSanitizer.clean(item.getReason()),
                        TextSanitizer.cleanList(item.getNextSteps()),
                        TextSanitizer.clean(item.getSource())
                ))
                .toList();
    }

    private String buildAiSuggestion(SuggestionRequest request, StudentCourseMemory memory) {
        String prompt = buildPrompt(request, memory);
        try {
            String response = chatService.generate(prompt);
            return normalizeAiResponse(response);
        } catch (Exception ex) {
            log.warn("AI improve suggestion failed: {}", ex.getMessage());
            return null;
        }
    }

    private String buildPrompt(SuggestionRequest request, StudentCourseMemory memory) {
        Map<String, Object> snapshot = new LinkedHashMap<>();
        snapshot.put("studentId", memory.getStudentId());
        snapshot.put("courseId", memory.getCourseId());
        snapshot.put("classId", memory.getClassId());
        snapshot.put("summary", TextSanitizer.clean(memory.getSummary()));
        snapshot.put("weakTopics", TextSanitizer.cleanList(memory.getWeakTopics()));
        snapshot.put("learnedTopics", TextSanitizer.cleanList(memory.getLearnedTopics()));
        snapshot.put("recentQuestions", TextSanitizer.cleanList(memory.getRecentQuestions()));
        snapshot.put("recentAnswers", TextSanitizer.cleanList(memory.getRecentAnswers()));
        snapshot.put("improveSuggestions", TextSanitizer.cleanList(memory.getImproveSuggestions()));

        String prompt = "You are an AI tutor improvement engine for university students. " +
                "Use only this student course memory, not global knowledge. " +
                "Return Vietnamese text as valid UTF-8 JSON only. No markdown. No strange encoded text. " +
                "Return one JSON object exactly like: " +
                "{\"suggestions\":[{\"title\":\"On lai OOP\",\"reason\":\"...\",\"nextSteps\":[\"...\"]}],\"notes\":\"...\"}.\n" +
                "Course-scoped memory: " + snapshot + "\n" +
                "Current question if any: " + TextSanitizer.clean(request.getQuestion());
        return TextSanitizer.clean(prompt);
    }

    private String normalizeAiResponse(String response) {
        if (response == null || response.isBlank()) {
            return "";
        }
        try {
            JsonNode root = objectMapper.readTree(response);
            if (root.has("suggestions")) {
                return TextSanitizer.clean(root.toString());
            }
        } catch (Exception ignored) {
            // fall back to raw response
        }
        return TextSanitizer.clean(response);
    }

    private String resolveStudentId(SuggestionRequest request) {
        if (request == null) {
            throw new IllegalArgumentException("request body is required");
        }
        if (request.getStudentId() != null && !request.getStudentId().isBlank()) {
            return request.getStudentId().trim();
        }
        return request.getUserId() != null && !request.getUserId().isBlank()
                ? request.getUserId().trim()
                : null;
    }
}