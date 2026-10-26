package com.ragapi.service.course.answer.grounding;

import com.ragapi.dto.RagSourceEvidence;
import com.ragapi.entity.CourseMaterial;
import com.ragapi.service.course.answer.grounding.evidence.CourseAnswerEvidenceSelector;
import com.ragapi.service.course.answer.grounding.evidence.CourseAnswerSourceService;
import com.ragapi.service.course.model.RetrievedCourseChunk;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Service
@RequiredArgsConstructor
public class CourseAnswerEvidenceService {

    private static final int QUIZ_FALLBACK_EVIDENCE_LIMIT = 3;
    private static final Pattern QUIZ_HEADING = Pattern.compile(
            "(?imu)^#{1,6}\\s*(?:kiểm tra hiểu|understanding check|quiz tự luyện)\\s*$");
    private static final Pattern NEXT_HEADING = Pattern.compile("(?m)^#{1,6}\\s+\\S");

    private final CourseAnswerSourceService sourceService;
    private final CourseAnswerEvidenceSelector evidenceSelector;

    public List<String> buildSourceLabels(
            List<RetrievedCourseChunk> chunks,
            Map<String, CourseMaterial> materialsById
    ) {
        return sourceService.buildSourceLabels(chunks, materialsById);
    }

    public String resolveGroundingType(
            List<RetrievedCourseChunk> chunks,
            Map<String, CourseMaterial> materialsById
    ) {
        return sourceService.resolveGroundingType(chunks, materialsById);
    }

    public List<RagSourceEvidence> buildSourceEvidence(
            List<RetrievedCourseChunk> chunks,
            String courseId,
            Map<String, CourseMaterial> materialsById,
            String answerFocus
    ) {
        return sourceService.buildSourceEvidence(chunks, courseId, materialsById, answerFocus);
    }

    /**
     * Evidence persisted with the answer. Besides the chunks that back the
     * lesson text, it keeps the chunks behind the appended quiz: a later
     * "giảng lại" turn re-uses exactly this provenance, and Worker 2 may build
     * its questions from a different chunk than the one Worker 1 explained.
     */
    public List<RetrievedCourseChunk> selectAnswerEvidenceChunks(
            List<RetrievedCourseChunk> chunks,
            String question,
            String answer
    ) {
        List<RetrievedCourseChunk> answerEvidence = evidenceSelector.selectAnswerEvidenceChunks(chunks, question, answer);
        String quiz = quizSection(answer);
        if (quiz == null) {
            return answerEvidence;
        }
        Map<String, RetrievedCourseChunk> merged = new LinkedHashMap<>();
        answerEvidence.forEach(chunk -> merged.putIfAbsent(chunkKey(chunk), chunk));
        evidenceSelector.selectAnswerEvidenceChunks(chunks, question, quiz)
                .forEach(chunk -> merged.putIfAbsent(chunkKey(chunk), chunk));
        if (merged.isEmpty() && chunks != null) {
            // Lexical alignment can miss entirely (Vietnamese quiz over English
            // material); keep the top-ranked retrieved chunks so the quiz never
            // loses the context it was generated from.
            chunks.stream()
                    .filter(chunk -> chunk != null && chunk.materialId() != null)
                    .limit(QUIZ_FALLBACK_EVIDENCE_LIMIT)
                    .forEach(chunk -> merged.putIfAbsent(chunkKey(chunk), chunk));
        }
        return List.copyOf(merged.values());
    }

    private static String quizSection(String answer) {
        if (answer == null) {
            return null;
        }
        Matcher matcher = QUIZ_HEADING.matcher(answer);
        if (!matcher.find()) {
            return null;
        }
        String quiz = answer.substring(matcher.start());
        Matcher next = NEXT_HEADING.matcher(quiz);
        if (next.find(matcher.end() - matcher.start())) {
            quiz = quiz.substring(0, next.start());
        }
        return quiz.isBlank() ? null : quiz;
    }

    private static String chunkKey(RetrievedCourseChunk chunk) {
        if (chunk.chunkId() != null && !chunk.chunkId().isBlank()) {
            return chunk.chunkId();
        }
        return chunk.materialId() + "#" + chunk.chunkIndex() + "#" + Objects.hashCode(chunk.content());
    }
}
