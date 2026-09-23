package com.ragapi.service.course.answer.grounding;

import com.ragapi.dto.RagSourceEvidence;
import com.ragapi.entity.CourseMaterial;
import com.ragapi.service.course.answer.grounding.evidence.CourseAnswerEvidenceSelector;
import com.ragapi.service.course.answer.grounding.evidence.CourseAnswerSourceService;
import com.ragapi.service.course.model.RetrievedCourseChunk;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class CourseAnswerEvidenceService {

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

    public List<RetrievedCourseChunk> selectAnswerEvidenceChunks(
            List<RetrievedCourseChunk> chunks,
            String question,
            String answer
    ) {
        return evidenceSelector.selectAnswerEvidenceChunks(chunks, question, answer);
    }
}
