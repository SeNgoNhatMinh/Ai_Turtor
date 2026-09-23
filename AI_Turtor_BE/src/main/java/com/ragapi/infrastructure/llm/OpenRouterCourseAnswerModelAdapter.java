package com.ragapi.infrastructure.llm;

import com.ragapi.service.OpenRouterChatService;
import com.ragapi.service.course.gateway.CourseAnswerModelGateway;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

/** OpenRouter/Ollama adapter exposed to course-answer services through a gateway. */
@Component
@RequiredArgsConstructor
public class OpenRouterCourseAnswerModelAdapter implements CourseAnswerModelGateway {

    private final OpenRouterChatService chatService;

    @Override
    public String generate(String prompt, String userMessage) {
        return chatService.generate(prompt, userMessage);
    }

    @Override
    public String generateUtility(String prompt) {
        return chatService.generateUtility(prompt);
    }

    @Override
    public boolean isOllamaOnlyActive() {
        return chatService.isOllamaOnlyActive();
    }
}
