package com.ragapi.harness.learning;
import static com.ragapi.util.ValidationUtils.DEFAULT_TEXT_MAX_LENGTH;
import static com.ragapi.util.ValidationUtils.REVIEW_NOTE_MAX_LENGTH;
import static com.ragapi.util.ValidationUtils.SHORT_TEXT_MAX_LENGTH;
import static com.ragapi.util.ValidationUtils.optionalMaxLength;
import static com.ragapi.util.ValidationUtils.requireEnum;
import static com.ragapi.util.ValidationUtils.requireMaxLength;
import static com.ragapi.util.ValidationUtils.requireText;
import com.ragapi.harness.aiworker.AiWorkerResult.Status;
import com.ragapi.harness.review.CanonicalTutorAnswerCacheService;
import com.ragapi.service.course.CourseMaterialChunkingService;
import com.ragapi.service.student.KnowledgeImageStorageService;
import com.ragapi.service.notification.RealtimeEventService;
import com.ragapi.service.notification.UserNotificationService;

import com.ragapi.service.course.gateway.CourseMaterialIndexGateway;
import com.ragapi.dto.KnowledgeCandidateReviewRequest;
import com.ragapi.dto.MentorAnswerRequest;
import com.ragapi.dto.ExistingAcademicKnowledge;
import com.ragapi.entity.ClassSection;
import com.ragapi.entity.CourseMaterial;
import com.ragapi.harness.entity.KnowledgeCandidate;
import com.ragapi.harness.entity.KnowledgeImageAttachment;
import com.ragapi.harness.entity.MentorAnswer;
import com.ragapi.harness.entity.QuestionEscalation;
import com.ragapi.entity.UserNotification;
import com.ragapi.repository.ClassSectionRepository;
import com.ragapi.repository.CourseMaterialRepository;
import com.ragapi.harness.repository.KnowledgeCandidateRepository;
import com.ragapi.repository.MentorRepository;
import com.ragapi.harness.repository.MentorAnswerRepository;
import com.ragapi.harness.repository.QuestionEscalationRepository;
import com.ragapi.util.RichTextPlainText;
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


@Slf4j
@Service
@AllArgsConstructor
public class HumanLearningService {

    static final String STATUS_PENDING_SENIOR_REVIEW = "PENDING_SENIOR_REVIEW";
    static final String STATUS_LEGACY_PENDING_REVIEW = "PENDING_REVIEW";
    static final String STATUS_REJECTED = "REJECTED";
    static final String STATUS_INDEXED = "INDEXED";
    static final String STATUS_UNINDEXED = "UNINDEXED";
    static final String STATUS_SUPERSEDED = "SUPERSEDED";

    private final QuestionEscalationRepository escalationRepository;
    private final MentorRepository mentorRepository;
    private final MentorAnswerRepository mentorAnswerRepository;
    private final KnowledgeCandidateRepository knowledgeCandidateRepository;
    private final CourseMaterialRepository courseMaterialRepository;
    private final CourseMaterialChunkingService chunkingService;
    private final CourseMaterialIndexGateway vectorService;
    private final KnowledgeImageStorageService knowledgeImageStorageService;
    private final CanonicalTutorAnswerCacheService answerCacheService;
    private final ClassSectionRepository classSectionRepository;
    private final RealtimeEventService realtimeEvents;
    private final UserNotificationService notifications;


    private ApprovedKnowledgeSupport knowledge() {
        return new ApprovedKnowledgeSupport(
                escalationRepository,
                mentorRepository,
                mentorAnswerRepository,
                knowledgeCandidateRepository,
                courseMaterialRepository,
                chunkingService,
                vectorService,
                knowledgeImageStorageService,
                answerCacheService,
                classSectionRepository,
                realtimeEvents,
                notifications);
    }

    private void publishKnowledgeCandidateEvent(KnowledgeCandidate candidate, String eventType) {
        if (candidate == null || candidate.getId() == null) return;
        try {
            Map<String, Object> data = new LinkedHashMap<>();
            data.put("candidateId", candidate.getId());
            data.put("questionEscalationId", candidate.getQuestionEscalationId() == null
                    ? "" : candidate.getQuestionEscalationId());
            data.put("courseId", candidate.getCourseId() == null ? "" : candidate.getCourseId());
            data.put("classId", candidate.getClassId() == null ? "" : candidate.getClassId());
            data.put("teacherId", candidate.getTeacherId() == null ? "" : candidate.getTeacherId());
            data.put("materialId", candidate.getMaterialId() == null ? "" : candidate.getMaterialId());
            data.put("status", candidate.getStatus() == null ? "" : candidate.getStatus());

            boolean pendingReview = "KNOWLEDGE_CANDIDATE_CREATED".equals(eventType)
                    && (STATUS_PENDING_SENIOR_REVIEW.equalsIgnoreCase(candidate.getStatus())
                    || STATUS_LEGACY_PENDING_REVIEW.equalsIgnoreCase(candidate.getStatus()));
            if (pendingReview) {
                try {
                    notifications.publishStoredOrRoles(
                            notifications.recordKnowledgeReview(candidate),
                            List.of("SENIOR_MENTOR", "ADMIN"),
                            eventType,
                            "KNOWLEDGE_CANDIDATE",
                            candidate.getId(),
                            candidate.getStatus(),
                            data
                    );
                } catch (Exception notifyError) {
                    log.warn("Could not store knowledge-review notifications for {}: {}",
                            candidate.getId(), notifyError.getMessage());
                    realtimeEvents.publishToRoles(
                            List.of("SENIOR_MENTOR", "ADMIN"),
                            eventType,
                            "KNOWLEDGE_CANDIDATE",
                            candidate.getId(),
                            candidate.getStatus(),
                            data
                    );
                }
            } else {
                realtimeEvents.publishToRoles(
                        List.of("SENIOR_MENTOR", "ADMIN"),
                        eventType,
                        "KNOWLEDGE_CANDIDATE",
                        candidate.getId(),
                        candidate.getStatus(),
                        data
                );
            }
            if (candidate.getTeacherId() != null && !candidate.getTeacherId().isBlank()) {
                realtimeEvents.publishToUser(
                        candidate.getTeacherId(),
                        eventType,
                        "KNOWLEDGE_CANDIDATE",
                        candidate.getId(),
                        candidate.getStatus(),
                        data
                );
            }
        } catch (Exception error) {
            log.warn("Could not publish {} for knowledge candidate {}: {}",
                    eventType, candidate.getId(), error.getMessage());
        }
    }

    /** Notifies the student and the class teacher that a support request was answered. */
    private void publishEscalationAnswered(QuestionEscalation escalation) {
        knowledge().publishEscalationAnswered(escalation, null);
    }

    private void publishEscalationAnswered(QuestionEscalation escalation, UserNotification notification) {
        knowledge().publishEscalationAnswered(escalation, notification);
    }

    public Map<String, Object> answerEscalation(String escalationId, MentorAnswerRequest request) {
        if (request == null) {
            throw new IllegalArgumentException("request body is required");
        }
        String realEscalationId = requireText(escalationId, "questionEscalationId");
        String teacherId = requireText(request.getTeacherId(), "teacherId");
        String answer = RichTextPlainText.toPlain(
                requireMaxLength(request.getAnswer(), "answer", DEFAULT_TEXT_MAX_LENGTH));
        if (answer == null || answer.isBlank()) {
            throw new IllegalArgumentException("answer is required");
        }
        List<KnowledgeImageAttachment> images = knowledgeImageStorageService.resolveAttachments(request.getImageIds());

        QuestionEscalation escalation = escalationRepository.findById(realEscalationId)
                .orElseThrow(() -> new IllegalArgumentException("Question escalation not found"));
        knowledge().requireAssignedTeacher(escalation, teacherId);

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
            String candidateType = knowledge().normalizeCandidateType(request.getCandidateType());
            knowledge().validateLearnableCandidateType(candidateType);
            if (escalation.getCourseId() == null || escalation.getCourseId().isBlank()) {
                throw new IllegalArgumentException("courseId is required to create an AI learning candidate");
            }
            candidate = knowledge().buildCandidate(escalation, mentorAnswer, candidateType, now);
            candidate = knowledgeCandidateRepository.save(candidate);
            publishKnowledgeCandidateEvent(candidate, "KNOWLEDGE_CANDIDATE_CREATED");
            escalation.setStatus("ANSWERED_PENDING_SENIOR_REVIEW");
        } else {
            escalation.setStatus("ANSWERED_NO_KNOWLEDGE_CANDIDATE");
        }

        escalation.setAssignedMentorId(teacherId);
        escalation.setAssignedMentorName(optionalMaxLength(request.getTeacherName(), "teacherName", SHORT_TEXT_MAX_LENGTH));
        escalation.setIdempotencyKey(null);
        escalation.setUpdatedAt(now);
        escalationRepository.save(escalation);
        UserNotification notification = null;
        try {
            notification = notifications.recordTeacherReply(
                    escalation,
                    escalation.getAssignedMentorName());
        } catch (RuntimeException error) {
            log.warn("Could not store support reply notification for {}: {}",
                    escalation.getId(), error.getMessage());
        }
        publishEscalationAnswered(escalation, notification);

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("questionEscalationId", escalation.getId());
        response.put("chatRoomId", escalation.getChatRoomId() == null ? "" : escalation.getChatRoomId());
        response.put("mentorAnswerId", mentorAnswer.getId());
        response.put("mentorAnswer", mentorAnswer);
        response.put("escalationStatus", escalation.getStatus());
        response.put("studentVisibleStatus", knowledge().toStudentVisibleStatus(escalation.getStatus()));
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
        knowledge().requireEscalationViewer(escalation, requesterId, requesterRole);
        List<MentorAnswer> mentorAnswers = mentorAnswerRepository.findByQuestionEscalationId(realEscalationId);
        List<KnowledgeCandidate> candidates = knowledgeCandidateRepository.findByQuestionEscalationId(realEscalationId);

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("questionEscalation", escalation);
        response.put("mentorAnswers", mentorAnswers);
        response.put("latestMentorAnswer", mentorAnswers.isEmpty() ? "" : mentorAnswers.get(mentorAnswers.size() - 1));
        response.put("knowledgeCandidates", candidates);
        response.put("latestKnowledgeCandidate", candidates.isEmpty() ? "" : candidates.get(candidates.size() - 1));
        response.put("studentVisibleStatus", knowledge().toStudentVisibleStatus(escalation.getStatus()));
        response.put("aiBrainUpdated", candidates.stream().anyMatch(candidate -> STATUS_INDEXED.equalsIgnoreCase(candidate.getStatus())));
        return response;
    }

    public void hideEscalationFromTeacherInbox(String escalationId, String teacherId) {
        String realEscalationId = requireText(escalationId, "questionEscalationId");
        String realTeacherId = requireText(teacherId, "teacherId");
        QuestionEscalation escalation = escalationRepository.findById(realEscalationId)
                .orElseThrow(() -> new IllegalArgumentException("Question escalation not found"));
        knowledge().requireAssignedTeacher(escalation, realTeacherId);

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
        knowledge().requireAssignedTeacher(escalation, teacherId);
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

        String candidateType = knowledge().normalizeCandidateType(request.getCandidateType());
        knowledge().validateLearnableCandidateType(candidateType);
        LocalDateTime now = LocalDateTime.now();
        KnowledgeCandidate candidate = knowledgeCandidateRepository.save(
                knowledge().buildCandidate(escalation, mentorAnswer, candidateType, now));
        publishKnowledgeCandidateEvent(candidate, "KNOWLEDGE_CANDIDATE_CREATED");
        escalation.setStatus("ANSWERED_PENDING_SENIOR_REVIEW");
        escalation.setIdempotencyKey(null);
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

        knowledge().validateCandidateCanBeReviewed(candidate);
        knowledge().validateSeniorReviewer(candidate, request);
        knowledge().validateLearnableCandidateType(knowledge().normalizeCandidateType(candidate.getCandidateType()));

        String reviewerId = request.getReviewerId().trim();
        String approvedAnswer = RichTextPlainText.toPlain(
                request.getContentOverride() != null && !request.getContentOverride().isBlank()
                ? requireMaxLength(request.getContentOverride(), "contentOverride", DEFAULT_TEXT_MAX_LENGTH)
                : (candidate.getAnswer() != null && !candidate.getAnswer().isBlank()
                        ? candidate.getAnswer()
                        : candidate.getContent()));
        if (approvedAnswer == null || approvedAnswer.isBlank()) {
            throw new IllegalArgumentException("answer is required");
        }
        String question = RichTextPlainText.toPlain(candidate.getQuestion());
        candidate.setQuestion(question == null ? "" : question);
        String content = """
                [KIẾN THỨC BỔ SUNG ĐÃ ĐƯỢC SENIOR DUYỆT]
                Câu hỏi: %s
                Câu trả lời: %s
                """.formatted(candidate.getQuestion(), approvedAnswer)
                + KnowledgeImageStorageService.formatImageAppendix(candidate.getImages());

        LocalDateTime now = LocalDateTime.now();
        CourseMaterial material = courseMaterialRepository
                .findFirstByKnowledgeCandidateId(candidate.getId())
                .orElseGet(CourseMaterial::new);
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
        material.setApprovedByName(knowledge().trimToNull(request.getReviewerName()));
        material.setApprovedAt(now);
        material.setIndexingStatus("PROCESSING");
        material.setIndexingError(null);
        courseMaterialRepository.save(material);

        try {
            List<String> chunks = chunkingService.chunk(content);
            if (chunks == null || chunks.isEmpty()) {
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
            material.setIndexingStatus("INDEXED");
            material.setIndexedAt(now);
            material.setIndexingError(null);
            courseMaterialRepository.save(material);
        } catch (IOException | RuntimeException error) {
            material.setIndexingStatus("FAILED");
            material.setIndexingError(error.getMessage());
            courseMaterialRepository.save(material);
            throw error;
        }

        // Keep the previous approved answer available until the replacement
        // has been indexed successfully.
        knowledge().supersedeIndexedDuplicates(candidate, now);

        candidate.setContent(content);
        candidate.setAnswer(approvedAnswer);
        candidate.setMaterialId(material.getId());
        candidate.setStatus(STATUS_INDEXED);
        candidate.setReviewedBy(reviewerId);
        candidate.setReviewerRole(knowledge().normalizeUpper(request.getReviewerRole()));
        candidate.setReviewerName(knowledge().trimToNull(request.getReviewerName()));
        candidate.setReviewNote(optionalMaxLength(request.getReviewNote(), "reviewNote", REVIEW_NOTE_MAX_LENGTH));
        candidate.setReviewedAt(now);
        candidate.setIndexedAt(now);
        candidate.setUpdatedAt(now);
        KnowledgeCandidate savedCandidate = knowledgeCandidateRepository.save(candidate);
        answerCacheService.evictRagAnswersForCourse(savedCandidate.getCourseId());
        knowledge().markEscalationIndexed(savedCandidate);
        publishKnowledgeCandidateEvent(savedCandidate, "KNOWLEDGE_CANDIDATE_INDEXED");
        return savedCandidate;
    }

    public KnowledgeCandidate rejectCandidate(String candidateId, KnowledgeCandidateReviewRequest request) {
        String realCandidateId = requireText(candidateId, "candidateId");
        KnowledgeCandidate candidate = knowledgeCandidateRepository.findById(realCandidateId)
                .orElseThrow(() -> new IllegalArgumentException("Knowledge candidate not found"));

        knowledge().validateCandidateCanBeReviewed(candidate);
        knowledge().validateSeniorReviewer(candidate, request);

        LocalDateTime now = LocalDateTime.now();
        candidate.setStatus(STATUS_REJECTED);
        candidate.setReviewedBy(request.getReviewerId().trim());
        candidate.setReviewerRole(knowledge().normalizeUpper(request.getReviewerRole()));
        candidate.setReviewerName(knowledge().trimToNull(request.getReviewerName()));
        candidate.setReviewNote(optionalMaxLength(request.getReviewNote(), "reviewNote", REVIEW_NOTE_MAX_LENGTH));
        candidate.setRejectionReason(requireMaxLength(request.getRejectionReason(), "rejectionReason", SHORT_TEXT_MAX_LENGTH));
        candidate.setReviewedAt(now);
        candidate.setUpdatedAt(now);
        KnowledgeCandidate savedCandidate = knowledgeCandidateRepository.save(candidate);
        knowledge().updateEscalationAfterCandidateRejected(savedCandidate);
        publishKnowledgeCandidateEvent(savedCandidate, "KNOWLEDGE_CANDIDATE_REJECTED");
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
        knowledge().annotateExistingAcademicKnowledge(filtered);
        annotateIndexingState(filtered);
        return filtered;
    }

    private void annotateIndexingState(List<KnowledgeCandidate> candidates) {
        for (KnowledgeCandidate candidate : candidates) {
            if (candidate.getId() == null || candidate.getId().isBlank()) {
                continue;
            }
            courseMaterialRepository.findFirstByKnowledgeCandidateId(candidate.getId()).ifPresent(material -> {
                candidate.setIndexingStatus(material.getIndexingStatus());
                candidate.setIndexingError(material.getIndexingError());
            });
        }
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
        KnowledgeCandidate candidate = knowledge().requireManagedIndexedCandidate(candidateId);
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

        CourseMaterial material = knowledge().loadMaterialForCandidate(candidate);
        if (material != null) {
            material.setTitle("Senior-approved knowledge: " + candidate.getQuestion());
            material.setContent(content);
            if (reindex || STATUS_INDEXED.equalsIgnoreCase(candidate.getStatus())) {
                knowledge().rewriteCandidateIndex(candidate, material, content);
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
        publishKnowledgeCandidateEvent(saved, "KNOWLEDGE_CANDIDATE_UPDATED");
        return saved;
    }

    public KnowledgeCandidate reindexApprovedKnowledge(String candidateId) throws IOException {
        KnowledgeCandidate candidate = knowledge().requireManagedIndexedCandidate(candidateId);
        CourseMaterial material = knowledge().loadMaterialForCandidate(candidate);
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
        knowledge().rewriteCandidateIndex(candidate, material, content);
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
        publishKnowledgeCandidateEvent(saved, "KNOWLEDGE_CANDIDATE_INDEXED");
        return saved;
    }

    public KnowledgeCandidate unindexApprovedKnowledge(String candidateId) throws IOException {
        KnowledgeCandidate candidate = knowledge().requireManagedIndexedCandidate(candidateId);
        String materialId = knowledge().trimToNull(candidate.getMaterialId());
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
        publishKnowledgeCandidateEvent(saved, "KNOWLEDGE_CANDIDATE_UNINDEXED");
        return saved;
    }

    public void deleteIndexedApprovedKnowledge(String candidateId) throws IOException {
        KnowledgeCandidate candidate = knowledge().requireManagedIndexedCandidate(candidateId);
        String courseId = candidate.getCourseId();
        String materialId = knowledge().trimToNull(candidate.getMaterialId());
        if (materialId != null) {
            vectorService.deleteChunksByMaterialId(materialId);
            courseMaterialRepository.deleteById(materialId);
        }
        knowledgeCandidateRepository.deleteById(candidate.getId());
        publishKnowledgeCandidateEvent(candidate, "KNOWLEDGE_CANDIDATE_DELETED");
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
}

