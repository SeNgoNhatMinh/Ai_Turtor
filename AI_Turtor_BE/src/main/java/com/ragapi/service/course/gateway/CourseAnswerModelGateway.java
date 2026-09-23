package com.ragapi.service.course.gateway;

/** Model operations required by the course answer domain. */
public interface CourseAnswerModelGateway {

    String generate(String prompt, String userMessage);

    String generateUtility(String prompt);

    boolean isOllamaOnlyActive();
}
