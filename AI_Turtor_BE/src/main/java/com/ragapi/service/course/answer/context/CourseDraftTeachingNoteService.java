package com.ragapi.service.course.answer.context;

import org.springframework.stereotype.Service;

/** Adds temporary teacher guidance to an answer context without indexing it. */
@Service
public class CourseDraftTeachingNoteService {

    public String prepend(
            String context,
            String chapter,
            String teachingNote,
            String baselineDraftAnswer
    ) {
        StringBuilder prefix = new StringBuilder();
        if (teachingNote != null && !teachingNote.isBlank()) {
            prefix.append("""
                    Course-material teaching note (PREVIEW for Teacher exam — not indexed yet; textbook remains authoritative).
                    Chapter: %s
                    Student-facing key points summarized from course materials (checklist — cover every point that the textbook supports):
                    %s
                    """.formatted(
                    chapter == null ? "" : chapter.trim(),
                    teachingNote.trim()
            ));
        }
        if (baselineDraftAnswer != null && !baselineDraftAnswer.isBlank()) {
            if (!prefix.isEmpty()) {
                prefix.append('\n');
            }
            prefix.append("""
                    PRIOR DRAFT ANSWER (baseline exam — textbook/RAG only, before teaching-note checklist):
                    ---
                    %s
                    ---
                    SYNTHESIS TASK:
                    - Produce ONE improved final answer for the student.
                    - Keep useful accurate content from the prior draft.
                    - Add any checklist points from the teaching note that are supported by the textbook context but missing or weak in the prior draft.
                    - Do not become a thin paraphrase of only the teaching note; keep the fuller textbook-grounded explanation.
                    - If the teaching note conflicts with textbook excerpts, prefer the textbook and ignore the conflicting note.
                    """.formatted(baselineDraftAnswer.trim()));
        }
        if (prefix.isEmpty()) {
            return context == null ? "" : context;
        }
        if (context == null || context.isBlank()) {
            return prefix.toString();
        }
        return prefix + "\n\n" + context;
    }
}
