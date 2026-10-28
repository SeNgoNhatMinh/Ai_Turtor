package com.ragapi.dto;

import java.util.List;

/**
 * Admin-edited curriculum guide content shown to students. Keywords are not
 * accepted from the client: the server always derives them from the topic
 * titles so every keyword stays traceable to the school syllabus.
 */
public record UpdateLearningGuideRequest(
        String overview,
        List<String> knowledgeObjectives,
        List<String> skillObjectives,
        List<Topic> topics
) {
    public record Topic(String title, String detail) {
    }
}
