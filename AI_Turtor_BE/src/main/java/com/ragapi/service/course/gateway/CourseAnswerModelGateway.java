package com.ragapi.service.course.gateway;

/** Model operations required by the course answer domain. */
public interface CourseAnswerModelGateway {

    String generate(String prompt, String userMessage);

    String generateQualityFallback(String prompt, String userMessage);

    /** Worker 1 main-answer generation on its preferred model order. */
    String generateWorker1(String prompt, String userMessage);

    String generateUtility(String prompt);

    boolean isOllamaOnlyActive();
}
