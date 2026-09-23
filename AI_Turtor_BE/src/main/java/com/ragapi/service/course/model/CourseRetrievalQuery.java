package com.ragapi.service.course.model;

/** Search focus before translation and the expanded query sent to retrieval backends. */
public record CourseRetrievalQuery(String focus, String expandedQuestion) {
}
