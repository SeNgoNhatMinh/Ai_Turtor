package com.ragapi.service;

import com.ragapi.dto.KnowledgeCandidateReviewRequest;
import com.ragapi.dto.MentorAnswerRequest;
import com.ragapi.entity.CourseMaterial;
import com.ragapi.entity.KnowledgeCandidate;
import com.ragapi.entity.KnowledgeImageAttachment;
import com.ragapi.entity.MentorAnswer;
import com.ragapi.entity.QuestionEscalation;
import com.ragapi.repository.CourseMaterialRepository;
import com.ragapi.repository.KnowledgeCandidateRepository;
import com.ragapi.repository.MentorAnswerRepository;
import com.ragapi.repository.QuestionEscalationRepository;
import lombok.AllArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.time.LocalDateTime;
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

    private final QuestionEscalationRepository escalationRepository;
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

        if (courseId == null || courseId.isBlank()) {
            return candidates;
        }

        return candidates.stream()
                .filter(candidate -> courseId.equals(candidate.getCourseId()))
                .toList();
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
                || !teacherId.equals(escalation.getAssignedMentorId())) {
            throw new IllegalArgumentException("Only the mentor selected by the student can access this escalation");
        }
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




