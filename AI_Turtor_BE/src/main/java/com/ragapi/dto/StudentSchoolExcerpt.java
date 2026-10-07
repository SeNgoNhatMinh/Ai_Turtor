package com.ragapi.dto;

/** A student-visible textbook passage. No internal ids, scores, or teacher fields. */
public record StudentSchoolExcerpt(String chapterTitle, String text) {
}
