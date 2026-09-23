package com.ragapi.service.cotraining;

import com.ragapi.dto.cotraining.UpdateIndexedTeachingNoteRequest;
import com.ragapi.entity.CourseMaterial;
import com.ragapi.entity.GoldQa;
import com.ragapi.repository.CourseMaterialRepository;
import com.ragapi.repository.GoldQaRepository;
import com.ragapi.service.CanonicalTutorAnswerCacheService;
import com.ragapi.service.course.gateway.CourseMaterialIndexGateway;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Locale;
import java.util.Set;

import static com.ragapi.util.ValidationUtils.DEFAULT_TEXT_MAX_LENGTH;
import static com.ragapi.util.ValidationUtils.SHORT_TEXT_MAX_LENGTH;
import static com.ragapi.util.ValidationUtils.requireMaxLength;
import static com.ragapi.util.ValidationUtils.requireText;

/** Owns the MongoDB and Elasticsearch lifecycle of Senior-approved teaching notes. */
@Service
@RequiredArgsConstructor
public class ExpertTeachingNoteService {
    private static final Set<String> MANAGED_STATUSES = Set.of("INDEXED", "UNINDEXED");

    private final GoldQaRepository goldQaRepository;
    private final CourseMaterialRepository materialRepository;
    private final CourseMaterialIndexGateway materialIndexGateway;
    private final CanonicalTutorAnswerCacheService answerCacheService;
    private final ExpertTaskContributionService taskContributions;

    public List<GoldQa> list(String courseId, String status) {
        Set<String> statuses = status != null && !status.isBlank()
                ? Set.of(status.trim().toUpperCase(Locale.ROOT))
                : MANAGED_STATUSES;
        if (courseId != null && !courseId.isBlank()) {
            return goldQaRepository.findByCourseIdAndStatusInOrderByUpdatedAtDesc(courseId.trim(), statuses);
        }
        return goldQaRepository.findByStatusInOrderByUpdatedAtDesc(statuses);
    }

    public boolean manages(String id) {
        if (id == null || id.isBlank()) {
            return false;
        }
        return goldQaRepository.findById(id.trim())
                .map(gold -> MANAGED_STATUSES.contains(gold.getStatus()))
                .orElse(false);
    }

    public GoldQa update(String id, UpdateIndexedTeachingNoteRequest request) throws Exception {
        if (request == null) {
            throw new IllegalArgumentException("request is required");
        }
        GoldQa gold = requireManaged(id);
        if (request.getChapter() != null && !request.getChapter().isBlank()) {
            gold.setChapter(requireMaxLength(request.getChapter(), "chapter", SHORT_TEXT_MAX_LENGTH));
        }
        if (request.getQuestion() != null && !request.getQuestion().isBlank()) {
            gold.setQuestion(requireMaxLength(request.getQuestion(), "question", DEFAULT_TEXT_MAX_LENGTH));
        }
        if (request.getGoldAnswer() != null && !request.getGoldAnswer().isBlank()) {
            gold.setApprovedAnswer(requireMaxLength(
                    request.getGoldAnswer(), "approvedAnswer", DEFAULT_TEXT_MAX_LENGTH));
        }
        gold.setUpdatedAt(LocalDateTime.now());
        boolean shouldReindex = !Boolean.FALSE.equals(request.getReindex())
                || "INDEXED".equalsIgnoreCase(gold.getStatus());
        if (shouldReindex) {
            rewriteIndex(gold);
            gold.setStatus("INDEXED");
            gold.setIndexedAt(LocalDateTime.now());
        }
        GoldQa saved = goldQaRepository.save(gold);
        answerCacheService.evictRagAnswersForCourse(saved.getCourseId());
        return saved;
    }

    public GoldQa reindex(String id) throws Exception {
        GoldQa gold = requireManaged(id);
        rewriteIndex(gold);
        gold.setStatus("INDEXED");
        gold.setIndexedAt(LocalDateTime.now());
        gold.setUpdatedAt(LocalDateTime.now());
        GoldQa saved = goldQaRepository.save(gold);
        answerCacheService.evictRagAnswersForCourse(saved.getCourseId());
        return saved;
    }

    public GoldQa unindex(String id) throws Exception {
        GoldQa gold = requireManaged(id);
        materialIndexGateway.deleteChunksByMaterialId(gold.getId());
        materialRepository.findById(gold.getId()).ifPresent(material -> {
            material.setIndexingStatus("UNINDEXED");
            material.setIndexedAt(null);
            materialRepository.save(material);
        });
        gold.setStatus("UNINDEXED");
        gold.setIndexedAt(null);
        gold.setUpdatedAt(LocalDateTime.now());
        GoldQa saved = goldQaRepository.save(gold);
        answerCacheService.evictRagAnswersForCourse(saved.getCourseId());
        return saved;
    }

    public void delete(String id) throws Exception {
        GoldQa gold = requireManaged(id);
        String courseId = gold.getCourseId();
        String taskId = gold.getSourceTaskId();
        materialIndexGateway.deleteChunksByMaterialId(gold.getId());
        materialRepository.deleteById(gold.getId());
        goldQaRepository.deleteById(gold.getId());
        if (courseId != null && !courseId.isBlank()) {
            answerCacheService.evictRagAnswersForCourse(courseId);
        }
        taskContributions.refreshGoldTaskStatus(taskId, null);
    }

    public void indexApproved(GoldQa gold) throws Exception {
        LocalDateTime now = LocalDateTime.now();
        String content = buildContent(gold);
        CourseMaterial material = materialRepository.findById(gold.getId()).orElseGet(CourseMaterial::new);
        material.setId(gold.getId());
        material.setTitle("Senior-approved V2 Gold Q&A: " + gold.getQuestion());
        material.setCategory("senior-approved-knowledge");
        material.setCourseId(gold.getCourseId());
        material.setClassId(null);
        material.setTeacherId(gold.getAuthorId());
        material.setMaterialScope("COURSE_SHARED");
        material.setUploadedByRole("SENIOR_MENTOR");
        material.setContent(content);
        material.setSourceType("GOLD_QA");
        material.setApprovedBy(gold.getReviewedBy());
        material.setApprovedAt(gold.getReviewedAt() == null ? now : gold.getReviewedAt());
        material.setIndexingStatus("PROCESSING");
        material.setIndexingError(null);
        materialRepository.save(material);

        materialIndexGateway.indexChunk(
                gold.getCourseId(), null, gold.getAuthorId(), gold.getId(),
                "COURSE_SHARED", "GOLD_QA", null, null, content
        );
        material.setIndexingStatus("INDEXED");
        material.setIndexedAt(now);
        materialRepository.save(material);
        answerCacheService.evictRagAnswersForCourse(gold.getCourseId());
    }

    /** Synchronizes Gold Q&A when its CourseMaterial projection is deleted elsewhere. */
    public void onMaterialDeleted(String materialId) {
        if (materialId == null || materialId.isBlank()) {
            return;
        }
        goldQaRepository.findById(materialId).ifPresent(gold -> {
            if (!"EVALUATION".equalsIgnoreCase(gold.getUsage())) {
                gold.setStatus("UNINDEXED");
                gold.setIndexedAt(null);
                gold.setUpdatedAt(LocalDateTime.now());
                goldQaRepository.save(gold);
                answerCacheService.evictRagAnswersForCourse(gold.getCourseId());
            }
        });
    }

    private GoldQa requireManaged(String id) {
        GoldQa gold = goldQaRepository.findById(requireText(id, "id"))
                .orElseThrow(() -> new IllegalArgumentException("GoldQA not found"));
        if (!MANAGED_STATUSES.contains(gold.getStatus())) {
            throw new IllegalArgumentException(
                    "Chỉ quản lý được ghi chú đã duyệt nạp RAG (INDEXED/UNINDEXED). Status hiện tại: " + gold.getStatus());
        }
        if ("EVALUATION".equalsIgnoreCase(gold.getUsage())) {
            throw new IllegalArgumentException("EVALUATION holdout không được index vào RAG");
        }
        return gold;
    }

    private void rewriteIndex(GoldQa gold) throws Exception {
        if (gold.getApprovedAnswer() == null || gold.getApprovedAnswer().isBlank()) {
            gold.setApprovedAnswer(resolveIndexedAnswer(gold));
        }
        materialIndexGateway.deleteChunksByMaterialId(gold.getId());
        indexApproved(gold);
    }

    private String buildContent(GoldQa gold) {
        return ""
                + "Course-material teaching note (textbook/course materials are authoritative; this note must not contradict them).\n"
                + "Chapter: " + (gold.getChapter() == null ? "" : gold.getChapter()) + "\n"
                + "Student question: " + gold.getQuestion() + "\n"
                + "Senior-approved AI answer after the teacher-guided second exam:\n"
                + resolveIndexedAnswer(gold);
    }

    private String resolveIndexedAnswer(GoldQa gold) {
        if (gold.getApprovedAnswer() != null && !gold.getApprovedAnswer().isBlank()) {
            return gold.getApprovedAnswer();
        }
        if (Boolean.TRUE.equals(gold.getExamUsedTeachingNote())
                && gold.getExamAiAnswer() != null
                && !gold.getExamAiAnswer().isBlank()) {
            return gold.getExamAiAnswer();
        }
        return requireText(gold.getGoldAnswer(), "approvedAnswer");
    }
}
