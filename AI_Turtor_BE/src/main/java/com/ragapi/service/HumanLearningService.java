package com.ragapi.service;

import com.ragapi.dto.KnowledgeCandidateReviewRequest;
import com.ragapi.dto.MentorAnswerRequest;
import com.ragapi.dto.ExistingAcademicKnowledge;
import com.ragapi.entity.CourseMaterial;
import com.ragapi.entity.KnowledgeCandidate;
import com.ragapi.entity.KnowledgeImageAttachment;
import com.ragapi.entity.MentorAnswer;
import com.ragapi.entity.QuestionEscalation;
import com.ragapi.repository.CourseMaterialRepository;
import com.ragapi.repository.KnowledgeCandidateRepository;
import com.ragapi.repository.MentorRepository;
import com.ragapi.repository.MentorAnswerRepository;
import com.ragapi.repository.QuestionEscalationRepository;
import lombok.AllArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static com.ragapi.util.ValidationUtils.DEFAULT_TEXT_MAX_LENGTH;
import static com.ragapi.util.ValidationUtils.REVIEW_NOTE_MAX_LENGTH;
import static com.ragapi.util.ValidationUtils.SHORT_TEXT_MAX_LENGTH;
import static com.ragapi.util.ValidationUtils.optionalMaxLength;
import static com.ragapi.util.ValidationUtils.requireEnum;
import static com.ragapi.util.ValidationUtils.requireMaxLength;
import static com.ragapi.util.ValidationUtils.requireText;

@Slf4j
@Service
@AllArgsConstructor
public class HumanLearningService {

    private static final String STATUS_PENDING_SENIOR_REVIEW = "PENDING_SENIOR_REVIEW";
    private static final String STATUS_LEGACY_PENDING_REVIEW = "PENDING_REVIEW";
    private static final String STATUS_REJECTED = "REJECTED";
    private static final String STATUS_INDEXED = "INDEXED";
    private static final String STATUS_UNINDEXED = "UNINDEXED";
    private static final String STATUS_SUPERSEDED = "SUPERSEDED";

    private final QuestionEscalationRepository escalationRepository;
    private final MentorRepository mentorRepository;
    private final MentorAnswerRepository mentorAnswerRepository;
    private final KnowledgeCandidateRepository knowledgeCandidateRepository;
    private final CourseMaterialRepository courseMaterialRepository;
    private final CourseMaterialChunkingService chunkingService;
    private final ElasticVectorService vectorService;
    private final KnowledgeImageStorageService knowledgeImageStorageService;
    private final CanonicalTutorAnswerCacheService answerCacheService;

    public Map<String, Object> answerEscalation(String escalationId, MentorAnswerRequest request) {
        if (request == null) {
            throw new IllegalArgumentException("request body is required");
        }
        String realEscalationId = requireText(escalationId, "questionEscalationId");
        String teacherId = requireText(request.getTeacherId(), "teacherId");
        String answer = requireMaxLength(request.getAnswer(), "answer", DEFAULT_TEXT_MAX_LENGTH);
        List<KnowledgeImageAttachment> images = knowledgeImageStorageService.resolveAttachments(request.getImageIds());

        QuestionEscalation escalation = escalationRepository.findById(realEscalationId)
                .orElseThrow(() -> new IllegalArgumentException("Question escalation not found"));
        requireAssignedTeacher(escalation, teacherId);

        LocalDateTime now = LocalDateTime.now();
        MentorAnswer mentorAnswer = MentorAnswer.builder()
                .id(UUID.randomUUID().toString())
                .questionEscalationId(escalation.getId())
                .teacherId(teacherId)
                .teacherName(optionalMaxLength(request.getTeacherName(), "teacherName", SHORT_TEXT_MAX_LENGTH))
                .courseId(escalation.getCourseId())
                .classId(escalation.getClassId())
                .question(escalation.getOriginalQuestion())
                .answer(answer)
                .images(images.isEmpty() ? null : images)
                .answeredAt(now)
                .createdAt(now)
                .build();
        mentorAnswer = mentorAnswerRepository.save(mentorAnswer);

        KnowledgeCandidate candidate = null;
        if (Boolean.TRUE.equals(request.getCreateKnowledgeCandidate())) {
            String candidateType = normalizeCandidateType(request.getCandidateType());
            validateLearnableCandidateType(candidateType);
            if (escalation.getCourseId() == null || escalation.getCourseId().isBlank()) {
                throw new IllegalArgumentException("courseId is required to create an AI learning candidate");
            }
            candidate = buildCandidate(escalation, mentorAnswer, candidateType, now);
            candidate = knowledgeCandidateRepository.save(candidate);
            escalation.setStatus("ANSWERED_PENDING_SENIOR_REVIEW");
        } else {
            escalation.setStatus("ANSWERED_NO_KNOWLEDGE_CANDIDATE");
        }

        escalation.setAssignedMentorId(teacherId);
        escalation.setAssignedMentorName(optionalMaxLength(request.getTeacherName(), "teacherName", SHORT_TEXT_MAX_LENGTH));
        escalation.setUpdatedAt(now);
        escalationRepository.save(escalation);

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("questionEscalationId", escalation.getId());
        response.put("chatRoomId", escalation.getChatRoomId() == null ? "" : escalation.getChatRoomId());
        response.put("mentorAnswerId", mentorAnswer.getId());
        response.put("mentorAnswer", mentorAnswer);
        response.put("escalationStatus", escalation.getStatus());
        response.put("studentVisibleStatus", toStudentVisibleStatus(escalation.getStatus()));
        response.put("knowledgeCandidateCreated", candidate != null);
        response.put("alreadyExists", false);
        response.put("knowledgeCandidate", candidate == null ? "" : candidate);
        response.put("candidateId", candidate == null ? "" : candidate.getId());
        response.put("candidateStatus", candidate == null ? "" : candidate.getStatus());
        response.put("message", candidate == null
                ? "Teacher answer saved for the student. No AI learning candidate was created."
                : "Teacher answer saved. Senior mentor approval is required before AI Tutor can learn it.");
        return response;
    }

    public Map<String, Object> submitTeacherChatAnswerAndCandidate(String chatRoomId, MentorAnswerRequest request) {
        String roomId = requireText(chatRoomId, "chatRoomId");
        QuestionEscalation escalation = escalationRepository.findByChatRoomId(roomId)
                .orElseThrow(() -> new IllegalArgumentException("No escalation is linked to this chat room"));

        List<KnowledgeCandidate> existing = knowledgeCandidateRepository.findByQuestionEscalationId(escalation.getId());
        if (!existing.isEmpty()) {
            KnowledgeCandidate candidate = existing.get(existing.size() - 1);
            Map<String, Object> response = new LinkedHashMap<>();
            response.put("questionEscalationId", escalation.getId());
            response.put("chatRoomId", roomId);
            response.put("knowledgeCandidateCreated", false);
            response.put("alreadyExists", true);
            response.put("knowledgeCandidate", candidate);
            response.put("candidateId", candidate.getId());
            response.put("candidateStatus", candidate.getStatus());
            response.put("message", "Câu trả lời đã được gửi. Knowledge candidate cho escalation này đã tồn tại.");
            return response;
        }

        if (request == null) {
            throw new IllegalArgumentException("request body is required");
        }
        request.setCreateKnowledgeCandidate(true);
        return answerEscalation(escalation.getId(), request);
    }

    public Map<String, Object> getEscalationDetail(
            String escalationId,
            String requesterId,
            String requesterRole
    ) {
        String realEscalationId = requireText(escalationId, "questionEscalationId");
        QuestionEscalation escalation = escalationRepository.findById(realEscalationId)
                .orElseThrow(() -> new IllegalArgumentException("Question escalation not found"));
        requireEscalationViewer(escalation, requesterId, requesterRole);
        List<MentorAnswer> mentorAnswers = mentorAnswerRepository.findByQuestionEscalationId(realEscalationId);
        List<KnowledgeCandidate> candidates = knowledgeCandidateRepository.findByQuestionEscalationId(realEscalationId);

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("questionEscalation", escalation);
        response.put("mentorAnswers", mentorAnswers);
        response.put("latestMentorAnswer", mentorAnswers.isEmpty() ? "" : mentorAnswers.get(mentorAnswers.size() - 1));
        response.put("knowledgeCandidates", candidates);
        response.put("latestKnowledgeCandidate", candidates.isEmpty() ? "" : candidates.get(candidates.size() - 1));
        response.put("studentVisibleStatus", toStudentVisibleStatus(escalation.getStatus()));
        response.put("aiBrainUpdated", candidates.stream().anyMatch(candidate -> STATUS_INDEXED.equalsIgnoreCase(candidate.getStatus())));
        return response;
    }

    public void hideEscalationFromTeacherInbox(String escalationId, String teacherId) {
        String realEscalationId = requireText(escalationId, "questionEscalationId");
        String realTeacherId = requireText(teacherId, "teacherId");
        QuestionEscalation escalation = escalationRepository.findById(realEscalationId)
                .orElseThrow(() -> new IllegalArgumentException("Question escalation not found"));
        requireAssignedTeacher(escalation, realTeacherId);

        if (escalation.getHiddenFromMentorInboxAt() == null) {
            escalation.setHiddenFromMentorInboxAt(LocalDateTime.now());
            escalation.setUpdatedAt(LocalDateTime.now());
            escalationRepository.save(escalation);
        }
    }

    public Map<String, Object> createKnowledgeCandidateAfterAnswer(
            String escalationId,
            MentorAnswerRequest request
    ) {
        if (request == null) {
            throw new IllegalArgumentException("request body is required");
        }
        String realEscalationId = requireText(escalationId, "questionEscalationId");
        String teacherId = requireText(request.getTeacherId(), "teacherId");
        QuestionEscalation escalation = escalationRepository.findById(realEscalationId)
                .orElseThrow(() -> new IllegalArgumentException("Question escalation not found"));
        requireAssignedTeacher(escalation, teacherId);
        if (escalation.getCourseId() == null || escalation.getCourseId().isBlank()) {
            throw new IllegalArgumentException("courseId is required to create an AI learning candidate");
        }

        List<KnowledgeCandidate> existing = knowledgeCandidateRepository
                .findByQuestionEscalationId(realEscalationId);
        if (!existing.isEmpty()) {
            KnowledgeCandidate candidate = existing.get(existing.size() - 1);
            return Map.of(
                    "questionEscalationId", escalation.getId(),
                    "knowledgeCandidateCreated", false,
                    "alreadyExists", true,
                    "knowledgeCandidate", candidate,
                    "candidateId", candidate.getId(),
                    "candidateStatus", candidate.getStatus()
            );
        }

        List<MentorAnswer> answers = mentorAnswerRepository
                .findByQuestionEscalationId(realEscalationId);
        MentorAnswer mentorAnswer = answers.stream()
                .filter(answer -> teacherId.equals(answer.getTeacherId()))
                .reduce((first, second) -> second)
                .orElseThrow(() -> new IllegalArgumentException(
                        "Teacher must answer the escalation before creating a knowledge candidate"));

        String candidateType = normalizeCandidateType(request.getCandidateType());
        validateLearnableCandidateType(candidateType);
        LocalDateTime now = LocalDateTime.now();
        KnowledgeCandidate candidate = knowledgeCandidateRepository.save(
                buildCandidate(escalation, mentorAnswer, candidateType, now));
        escalation.setStatus("ANSWERED_PENDING_SENIOR_REVIEW");
        escalation.setUpdatedAt(now);
        escalationRepository.save(escalation);

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("questionEscalationId", escalation.getId());
        response.put("knowledgeCandidateCreated", true);
        response.put("alreadyExists", false);
        response.put("knowledgeCandidate", candidate);
        response.put("candidateId", candidate.getId());
        response.put("candidateStatus", candidate.getStatus());
        response.put("message", "Knowledge Candidate đã được gửi đến senior mentor để duyệt.");
        return response;
    }
    public KnowledgeCandidate approveCandidate(String candidateId, KnowledgeCandidateReviewRequest request) throws IOException {
        String realCandidateId = requireText(candidateId, "candidateId");
        KnowledgeCandidate candidate = knowledgeCandidateRepository.findById(realCandidateId)
                .orElseThrow(() -> new IllegalArgumentException("Knowledge candidate not found"));

        validateCandidateCanBeReviewed(candidate);
        validateSeniorReviewer(candidate, request);
        validateLearnableCandidateType(normalizeCandidateType(candidate.getCandidateType()));

        String reviewerId = request.getReviewerId().trim();
        String approvedAnswer = request.getContentOverride() != null && !request.getContentOverride().isBlank()
                ? requireMaxLength(request.getContentOverride(), "contentOverride", DEFAULT_TEXT_MAX_LENGTH)
                : (candidate.getAnswer() != null && !candidate.getAnswer().isBlank()
                        ? candidate.getAnswer()
                        : candidate.getContent());
        String content = """
                [KIẾN THỨC BỔ SUNG ĐÃ ĐƯỢC SENIOR DUYỆT]
                Câu hỏi: %s
                Câu trả lời: %s
                """.formatted(candidate.getQuestion(), approvedAnswer)
                + KnowledgeImageStorageService.formatImageAppendix(candidate.getImages());

        LocalDateTime now = LocalDateTime.now();
        supersedeIndexedDuplicates(candidate, now);

        CourseMaterial material = new CourseMaterial();
        material.setTitle("Senior-approved knowledge: " + candidate.getQuestion());
        material.setCategory("senior-approved-knowledge");
        material.setCourseId(candidate.getCourseId());
        material.setClassId(null);
        material.setTeacherId(reviewerId);
        material.setMaterialScope("COURSE_SHARED");
        material.setUploadedByRole("SENIOR_MENTOR");
        material.setContent(content);
        material.setSourceType("KNOWLEDGE_CANDIDATE");
        material.setKnowledgeCandidateId(candidate.getId());
        material.setApprovedBy(reviewerId);
        material.setApprovedByName(trimToNull(request.getReviewerName()));
        material.setApprovedAt(now);
        material.setIndexingStatus("PROCESSING");
        courseMaterialRepository.save(material);

        List<String> chunks = chunkingService.chunk(content);
        vectorService.indexChunks(
                material.getCourseId(),
                material.getClassId(),
                material.getTeacherId(),
                material.getId(),
                material.getMaterialScope(),
                "KNOWLEDGE_CANDIDATE",
                null,
                null,
                chunks
        );
        material.setIndexingStatus("INDEXED");
        material.setIndexedAt(now);
        courseMaterialRepository.save(material);

        candidate.setContent(content);
        candidate.setAnswer(approvedAnswer);
        candidate.setMaterialId(material.getId());
        candidate.setStatus(STATUS_INDEXED);
        candidate.setReviewedBy(reviewerId);
        candidate.setReviewerRole(normalizeUpper(request.getReviewerRole()));
        candidate.setReviewerName(trimToNull(request.getReviewerName()));
        candidate.setReviewNote(optionalMaxLength(request.getReviewNote(), "reviewNote", REVIEW_NOTE_MAX_LENGTH));
        candidate.setReviewedAt(now);
        candidate.setIndexedAt(now);
        candidate.setUpdatedAt(now);
        KnowledgeCandidate savedCandidate = knowledgeCandidateRepository.save(candidate);
        answerCacheService.evictRagAnswersForCourse(savedCandidate.getCourseId());
        markEscalationIndexed(savedCandidate);
        return savedCandidate;
    }

    public KnowledgeCandidate rejectCandidate(String candidateId, KnowledgeCandidateReviewRequest request) {
        String realCandidateId = requireText(candidateId, "candidateId");
        KnowledgeCandidate candidate = knowledgeCandidateRepository.findById(realCandidateId)
                .orElseThrow(() -> new IllegalArgumentException("Knowledge candidate not found"));

        validateCandidateCanBeReviewed(candidate);
        validateSeniorReviewer(candidate, request);

        LocalDateTime now = LocalDateTime.now();
        candidate.setStatus(STATUS_REJECTED);
        candidate.setReviewedBy(request.getReviewerId().trim());
        candidate.setReviewerRole(normalizeUpper(request.getReviewerRole()));
        candidate.setReviewerName(trimToNull(request.getReviewerName()));
        candidate.setReviewNote(optionalMaxLength(request.getReviewNote(), "reviewNote", REVIEW_NOTE_MAX_LENGTH));
        candidate.setRejectionReason(requireMaxLength(request.getRejectionReason(), "rejectionReason", SHORT_TEXT_MAX_LENGTH));
        candidate.setReviewedAt(now);
        candidate.setUpdatedAt(now);
        KnowledgeCandidate savedCandidate = knowledgeCandidateRepository.save(candidate);
        updateEscalationAfterCandidateRejected(savedCandidate);
        return savedCandidate;
    }

    public List<KnowledgeCandidate> listCandidates(String status, String courseId) {
        List<KnowledgeCandidate> candidates = status != null && !status.isBlank()
                ? knowledgeCandidateRepository.findByStatus(status.trim().toUpperCase())
                : knowledgeCandidateRepository.findAll();

        List<KnowledgeCandidate> filtered = courseId == null || courseId.isBlank()
                ? candidates
                : candidates.stream()
                        .filter(candidate -> courseId.equals(candidate.getCourseId()))
                        .toList();
        annotateExistingAcademicKnowledge(filtered);
        return filtered;
    }

    public List<KnowledgeCandidate> listIndexedApprovedKnowledge(String courseId, String status) {
        java.util.Set<String> statuses;
        if (status != null && !status.isBlank()) {
            statuses = java.util.Set.of(status.trim().toUpperCase());
        } else {
            statuses = java.util.Set.of(STATUS_INDEXED, STATUS_UNINDEXED);
        }
        if (courseId != null && !courseId.isBlank()) {
            return knowledgeCandidateRepository.findByCourseIdAndStatusInOrderByIndexedAtDesc(courseId.trim(), statuses);
        }
        return knowledgeCandidateRepository.findByStatusInOrderByIndexedAtDesc(statuses);
    }

    public KnowledgeCandidate updateIndexedApprovedKnowledge(
            String candidateId,
            String question,
            String answer,
            boolean reindex
    ) throws IOException {
        KnowledgeCandidate candidate = requireManagedIndexedCandidate(candidateId);
        if (question != null && !question.isBlank()) {
            candidate.setQuestion(requireMaxLength(question, "question", DEFAULT_TEXT_MAX_LENGTH));
        }
        if (answer != null && !answer.isBlank()) {
            candidate.setAnswer(requireMaxLength(answer, "answer", DEFAULT_TEXT_MAX_LENGTH));
        }
        String content = """
                [KIẾN THỨC BỔ SUNG ĐÃ ĐƯỢC SENIOR DUYỆT]
                Câu hỏi: %s
                Câu trả lời: %s
                """.formatted(candidate.getQuestion(), candidate.getAnswer())
                + KnowledgeImageStorageService.formatImageAppendix(candidate.getImages());
        candidate.setContent(content);
        candidate.setUpdatedAt(LocalDateTime.now());

        CourseMaterial material = loadMaterialForCandidate(candidate);
        if (material != null) {
            material.setTitle("Senior-approved knowledge: " + candidate.getQuestion());
            material.setContent(content);
            if (reindex || STATUS_INDEXED.equalsIgnoreCase(candidate.getStatus())) {
                rewriteCandidateIndex(candidate, material, content);
                candidate.setStatus(STATUS_INDEXED);
                candidate.setIndexedAt(LocalDateTime.now());
                material.setIndexingStatus("INDEXED");
                material.setIndexedAt(LocalDateTime.now());
            }
            courseMaterialRepository.save(material);
        } else if (reindex) {
            throw new IllegalArgumentException("Không tìm thấy CourseMaterial gắn với knowledge candidate này");
        }
        KnowledgeCandidate saved = knowledgeCandidateRepository.save(candidate);
        answerCacheService.evictRagAnswersForCourse(saved.getCourseId());
        return saved;
    }

    public KnowledgeCandidate reindexApprovedKnowledge(String candidateId) throws IOException {
        KnowledgeCandidate candidate = requireManagedIndexedCandidate(candidateId);
        CourseMaterial material = loadMaterialForCandidate(candidate);
        if (material == null) {
            throw new IllegalArgumentException("Không tìm thấy CourseMaterial gắn với knowledge candidate này");
        }
        String content = candidate.getContent() != null && !candidate.getContent().isBlank()
                ? candidate.getContent()
                : """
                [KIẾN THỨC BỔ SUNG ĐÃ ĐƯỢC SENIOR DUYỆT]
                Câu hỏi: %s
                Câu trả lời: %s
                """.formatted(candidate.getQuestion(), candidate.getAnswer());
        rewriteCandidateIndex(candidate, material, content);
        material.setContent(content);
        material.setIndexingStatus("INDEXED");
        material.setIndexedAt(LocalDateTime.now());
        courseMaterialRepository.save(material);
        candidate.setContent(content);
        candidate.setStatus(STATUS_INDEXED);
        candidate.setIndexedAt(LocalDateTime.now());
        candidate.setUpdatedAt(LocalDateTime.now());
        KnowledgeCandidate saved = knowledgeCandidateRepository.save(candidate);
        answerCacheService.evictRagAnswersForCourse(saved.getCourseId());
        return saved;
    }

    public KnowledgeCandidate unindexApprovedKnowledge(String candidateId) throws IOException {
        KnowledgeCandidate candidate = requireManagedIndexedCandidate(candidateId);
        String materialId = trimToNull(candidate.getMaterialId());
        if (materialId != null) {
            vectorService.deleteChunksByMaterialId(materialId);
            courseMaterialRepository.findById(materialId).ifPresent(material -> {
                material.setIndexingStatus("UNINDEXED");
                material.setIndexedAt(null);
                courseMaterialRepository.save(material);
            });
        }
        candidate.setStatus(STATUS_UNINDEXED);
        candidate.setIndexedAt(null);
        candidate.setUpdatedAt(LocalDateTime.now());
        KnowledgeCandidate saved = knowledgeCandidateRepository.save(candidate);
        answerCacheService.evictRagAnswersForCourse(saved.getCourseId());
        return saved;
    }

    public void deleteIndexedApprovedKnowledge(String candidateId) throws IOException {
        KnowledgeCandidate candidate = requireManagedIndexedCandidate(candidateId);
        String courseId = candidate.getCourseId();
        String materialId = trimToNull(candidate.getMaterialId());
        if (materialId != null) {
            vectorService.deleteChunksByMaterialId(materialId);
            courseMaterialRepository.deleteById(materialId);
        }
        knowledgeCandidateRepository.deleteById(candidate.getId());
        if (courseId != null && !courseId.isBlank()) {
            answerCacheService.evictRagAnswersForCourse(courseId);
        }
    }

    /** Called when a CourseMaterial with sourceType=KNOWLEDGE_CANDIDATE is deleted. */
    public void onApprovedKnowledgeMaterialDeleted(String materialId) {
        if (materialId == null || materialId.isBlank()) {
            return;
        }
        knowledgeCandidateRepository.findByMaterialId(materialId).ifPresent(candidate -> {
            candidate.setStatus(STATUS_UNINDEXED);
            candidate.setMaterialId(null);
            candidate.setIndexedAt(null);
            candidate.setUpdatedAt(LocalDateTime.now());
            knowledgeCandidateRepository.save(candidate);
            if (candidate.getCourseId() != null && !candidate.getCourseId().isBlank()) {
                answerCacheService.evictRagAnswersForCourse(candidate.getCourseId());
            }
            log.info("Marked knowledge candidate {} UNINDEXED after material {} deleted",
                    candidate.getId(), materialId);
        });
    }

    private void supersedeIndexedDuplicates(KnowledgeCandidate incoming, LocalDateTime now) throws IOException {
        String courseId = trimToNull(incoming.getCourseId());
        String normalizedQuestion = normalizeQuestionKey(incoming.getQuestion());
        if (courseId == null || normalizedQuestion.isBlank()) {
            return;
        }
        List<KnowledgeCandidate> existing = knowledgeCandidateRepository.findByCourseIdAndStatus(courseId, STATUS_INDEXED);
        for (KnowledgeCandidate prior : existing) {
            if (prior.getId() != null && prior.getId().equals(incoming.getId())) {
                continue;
            }
            if (!normalizedQuestion.equals(normalizeQuestionKey(prior.getQuestion()))) {
                continue;
            }
            String materialId = trimToNull(prior.getMaterialId());
            if (materialId != null) {
                vectorService.deleteChunksByMaterialId(materialId);
                courseMaterialRepository.deleteById(materialId);
            }
            prior.setStatus(STATUS_SUPERSEDED);
            prior.setMaterialId(null);
            prior.setIndexedAt(null);
            prior.setUpdatedAt(now);
            prior.setReviewNote((prior.getReviewNote() == null ? "" : prior.getReviewNote() + " | ")
                    + "Superseded by newer Senior approval for the same question");
            knowledgeCandidateRepository.save(prior);
            log.info("Superseded indexed knowledge candidate {} with newer candidate {} (courseId={})",
                    prior.getId(), incoming.getId(), courseId);
        }
    }

    private KnowledgeCandidate requireManagedIndexedCandidate(String candidateId) {
        KnowledgeCandidate candidate = knowledgeCandidateRepository.findById(requireText(candidateId, "id"))
                .orElseThrow(() -> new IllegalArgumentException("Knowledge candidate not found"));
        if (!STATUS_INDEXED.equalsIgnoreCase(candidate.getStatus())
                && !STATUS_UNINDEXED.equalsIgnoreCase(candidate.getStatus())) {
            throw new IllegalArgumentException(
                    "Chỉ quản lý được knowledge đã duyệt nạp RAG (INDEXED/UNINDEXED). Status hiện tại: "
                            + candidate.getStatus());
        }
        return candidate;
    }

    private CourseMaterial loadMaterialForCandidate(KnowledgeCandidate candidate) {
        String materialId = trimToNull(candidate.getMaterialId());
        if (materialId == null) {
            return null;
        }
        return courseMaterialRepository.findById(materialId).orElse(null);
    }

    private void rewriteCandidateIndex(KnowledgeCandidate candidate, CourseMaterial material, String content)
            throws IOException {
        vectorService.deleteChunksByMaterialId(material.getId());
        List<String> chunks = chunkingService.chunk(content);
        if (chunks.isEmpty()) {
            chunks = List.of(content.trim());
        }
        vectorService.indexChunks(
                material.getCourseId(),
                material.getClassId(),
                material.getTeacherId(),
                material.getId(),
                material.getMaterialScope(),
                "KNOWLEDGE_CANDIDATE",
                null,
                null,
                chunks
        );
        candidate.setMaterialId(material.getId());
    }

    private static String normalizeQuestionKey(String question) {
        return com.ragapi.util.TextSanitizer.normalizeAccentInsensitive(question);
    }

    private void annotateExistingAcademicKnowledge(List<KnowledgeCandidate> candidates) {
        Map<String, List<KnowledgeCandidate>> indexedByCourse = new HashMap<>();
        for (KnowledgeCandidate candidate : candidates) {
            candidate.setExistingAcademicKnowledge(null);
            String courseId = trimToNull(candidate.getCourseId());
            String questionKey = normalizeQuestionKey(candidate.getQuestion());
            if (courseId == null || questionKey.isBlank() || STATUS_INDEXED.equals(candidate.getStatus())) {
                continue;
            }
            List<KnowledgeCandidate> indexed = indexedByCourse.computeIfAbsent(
                    courseId,
                    key -> knowledgeCandidateRepository.findByCourseIdAndStatus(key, STATUS_INDEXED)
            );
            indexed.stream()
                    .filter(existing -> !java.util.Objects.equals(existing.getId(), candidate.getId()))
                    .filter(existing -> questionKey.equals(normalizeQuestionKey(existing.getQuestion())))
                    .findFirst()
                    .ifPresent(existing -> candidate.setExistingAcademicKnowledge(
                            ExistingAcademicKnowledge.builder()
                                    .id(existing.getId())
                                    .question(existing.getQuestion())
                                    .answer(existing.getAnswer())
                                    .courseId(existing.getCourseId())
                                    .status(existing.getStatus())
                                    .indexedAt(existing.getIndexedAt())
                                    .build()
                    ));
        }
    }

    private void markEscalationIndexed(KnowledgeCandidate candidate) {
        String escalationId = trimToNull(candidate.getQuestionEscalationId());
        if (escalationId == null) {
            return;
        }
        escalationRepository.findById(escalationId).ifPresent(escalation -> {
            escalation.setStatus("RESOLVED_INDEXED");
            escalation.setUpdatedAt(LocalDateTime.now());
            escalationRepository.save(escalation);
        });
    }

    private void updateEscalationAfterCandidateRejected(KnowledgeCandidate candidate) {
        String escalationId = trimToNull(candidate.getQuestionEscalationId());
        if (escalationId == null) {
            return;
        }
        escalationRepository.findById(escalationId).ifPresent(escalation -> {
            escalation.setStatus("ANSWERED_KNOWLEDGE_REJECTED");
            escalation.setUpdatedAt(LocalDateTime.now());
            escalationRepository.save(escalation);
        });
    }

    private String toStudentVisibleStatus(String status) {
        String normalized = normalizeUpper(status);
        if (normalized == null || normalized.equals("PENDING_OFFER") || normalized.equals("OFFERED") || normalized.equals("IN_CHAT")) {
            return "WAITING_FOR_MENTOR";
        }
        if (normalized.equals("ANSWERED_PENDING_SENIOR_REVIEW")) {
            return "MENTOR_ANSWERED_PENDING_SENIOR_REVIEW";
        }
        if (normalized.equals("ANSWERED_NO_KNOWLEDGE_CANDIDATE") || normalized.equals("ANSWERED_KNOWLEDGE_REJECTED")) {
            return "MENTOR_ANSWERED";
        }
        if (normalized.equals("RESOLVED_INDEXED")) {
            return "AI_BRAIN_UPDATED";
        }
        return normalized;
    }

    private KnowledgeCandidate buildCandidate(
            QuestionEscalation escalation,
            MentorAnswer mentorAnswer,
            String candidateType,
            LocalDateTime now
    ) {
        String content = """
                Question:
                %s

                Teacher answer candidate, waiting for senior mentor approval:
                %s
                """.formatted(escalation.getOriginalQuestion(), mentorAnswer.getAnswer())
                + KnowledgeImageStorageService.formatImageAppendix(mentorAnswer.getImages());

        return KnowledgeCandidate.builder()
                .id(UUID.randomUUID().toString())
                .questionEscalationId(escalation.getId())
                .mentorAnswerId(mentorAnswer.getId())
                .courseId(escalation.getCourseId())
                .classId(escalation.getClassId())
                .teacherId(mentorAnswer.getTeacherId())
                .candidateType(candidateType)
                .sourceType("TEACHER_ESCALATION")
                .question(escalation.getOriginalQuestion())
                .answer(mentorAnswer.getAnswer())
                .content(content)
                .images(mentorAnswer.getImages())
                .status(STATUS_PENDING_SENIOR_REVIEW)
                .createdAt(now)
                .updatedAt(now)
                .build();
    }

    private void validateCandidateCanBeReviewed(KnowledgeCandidate candidate) {
        if (!STATUS_PENDING_SENIOR_REVIEW.equalsIgnoreCase(candidate.getStatus())
                && !STATUS_LEGACY_PENDING_REVIEW.equalsIgnoreCase(candidate.getStatus())) {
            throw new IllegalArgumentException("Only pending senior-review candidates can be approved or rejected");
        }
    }

    private void requireAssignedTeacher(QuestionEscalation escalation, String teacherId) {
        if (escalation == null
                || escalation.getAssignedMentorId() == null
                || escalation.getAssignedMentorId().isBlank()
                || !matchesTeacherId(teacherId, escalation.getAssignedMentorId())) {
            throw new IllegalArgumentException("Only the mentor selected by the student can access this escalation");
        }
    }

    private boolean matchesTeacherId(String requesterTeacherId, String assignedMentorKey) {
        if (requesterTeacherId == null || requesterTeacherId.isBlank()
                || assignedMentorKey == null || assignedMentorKey.isBlank()) {
            return false;
        }
        if (requesterTeacherId.equals(assignedMentorKey)) {
            return true;
        }

        var requesterMentor = mentorRepository.findById(requesterTeacherId)
                .or(() -> mentorRepository.findByMentorCode(requesterTeacherId));
        var assignedMentor = mentorRepository.findById(assignedMentorKey)
                .or(() -> mentorRepository.findByMentorCode(assignedMentorKey));

        if (requesterMentor.isPresent() && assignedMentor.isPresent()) {
            return requesterMentor.get().getId().equals(assignedMentor.get().getId());
        }
        if (requesterMentor.isPresent()) {
            return requesterMentor.get().getId().equals(assignedMentorKey)
                    || assignedMentorKey.equalsIgnoreCase(requesterMentor.get().getMentorCode());
        }
        if (assignedMentor.isPresent()) {
            return assignedMentor.get().getId().equals(requesterTeacherId)
                    || requesterTeacherId.equalsIgnoreCase(assignedMentor.get().getMentorCode());
        }
        return false;
    }

    private void requireEscalationViewer(
            QuestionEscalation escalation,
            String requesterId,
            String requesterRole
    ) {
        String actorId = trimToNull(requesterId);
        boolean admin = "ADMIN".equalsIgnoreCase(trimToNull(requesterRole));
        boolean studentOwner = actorId != null && actorId.equals(escalation.getUserId());
        boolean assignedMentor = actorId != null && actorId.equals(escalation.getAssignedMentorId());
        if (!admin && !studentOwner && !assignedMentor) {
            throw new SecurityException("Escalation is private to the student and selected mentor");
        }
    }

    private void validateSeniorReviewer(KnowledgeCandidate candidate, KnowledgeCandidateReviewRequest request) {
        if (request == null) {
            throw new IllegalArgumentException("review request body is required");
        }
        requireText(request.getReviewerId(), "reviewerId");
        String reviewerRole = requireEnum(request.getReviewerRole(), "reviewerRole", "SENIOR_MENTOR", "ADMIN");
        if (candidate.getTeacherId() != null && candidate.getTeacherId().equals(request.getReviewerId().trim())) {
            throw new IllegalArgumentException("The mentor who answered cannot approve their own knowledge candidate");
        }
    }

    private void validateLearnableCandidateType(String candidateType) {
        if (!"ACADEMIC_KNOWLEDGE".equals(candidateType)
                && !"MATERIAL_CORRECTION".equals(candidateType)
                && !"FAQ_CLARIFICATION".equals(candidateType)) {
            throw new IllegalArgumentException("Only ACADEMIC_KNOWLEDGE, MATERIAL_CORRECTION, or FAQ_CLARIFICATION can be indexed into AI Tutor brain");
        }
    }

    private String normalizeCandidateType(String candidateType) {
        String normalized = normalizeUpper(candidateType);
        return normalized == null ? "ACADEMIC_KNOWLEDGE" : normalized;
    }

    private String trimToNull(String value) {
        return optionalMaxLength(value, "value", SHORT_TEXT_MAX_LENGTH);
    }

    private String normalizeUpper(String value) {
        return value == null || value.isBlank() ? null : value.trim().toUpperCase();
    }
}




