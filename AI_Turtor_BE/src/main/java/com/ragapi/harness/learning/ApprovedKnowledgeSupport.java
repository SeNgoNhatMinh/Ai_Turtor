package com.ragapi.harness.learning;

import static com.ragapi.util.ValidationUtils.DEFAULT_TEXT_MAX_LENGTH;
import static com.ragapi.util.ValidationUtils.REVIEW_NOTE_MAX_LENGTH;
import static com.ragapi.util.ValidationUtils.SHORT_TEXT_MAX_LENGTH;
import static com.ragapi.util.ValidationUtils.optionalMaxLength;
import static com.ragapi.util.ValidationUtils.requireEnum;
import static com.ragapi.util.ValidationUtils.requireMaxLength;
import static com.ragapi.util.ValidationUtils.requireText;

import com.ragapi.dto.ExistingAcademicKnowledge;
import com.ragapi.dto.KnowledgeCandidateReviewRequest;
import com.ragapi.entity.ClassSection;
import com.ragapi.entity.CourseMaterial;
import com.ragapi.entity.UserNotification;
import com.ragapi.harness.entity.KnowledgeCandidate;
import com.ragapi.harness.entity.KnowledgeImageAttachment;
import com.ragapi.harness.entity.MentorAnswer;
import com.ragapi.harness.entity.QuestionEscalation;
import com.ragapi.harness.repository.KnowledgeCandidateRepository;
import com.ragapi.harness.repository.QuestionEscalationRepository;
import com.ragapi.harness.review.CanonicalTutorAnswerCacheService;
import com.ragapi.repository.ClassSectionRepository;
import com.ragapi.repository.CourseMaterialRepository;
import com.ragapi.repository.MentorRepository;
import com.ragapi.service.course.CourseMaterialChunkingService;
import com.ragapi.service.student.KnowledgeImageStorageService;
import com.ragapi.service.notification.RealtimeEventService;
import com.ragapi.service.notification.UserNotificationService;
import com.ragapi.service.course.gateway.CourseMaterialIndexGateway;
import com.ragapi.harness.repository.MentorAnswerRepository;
import java.io.IOException;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

/** Approved-knowledge indexing and the checks shared by mentor answers. */
@Slf4j
@RequiredArgsConstructor
class ApprovedKnowledgeSupport {

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

    void supersedeIndexedDuplicates(KnowledgeCandidate incoming, LocalDateTime now) throws IOException {
        String courseId = trimToNull(incoming.getCourseId());
        String normalizedQuestion = normalizeQuestionKey(incoming.getQuestion());
        if (courseId == null || normalizedQuestion.isBlank()) {
            return;
        }
        List<KnowledgeCandidate> existing = knowledgeCandidateRepository.findByCourseIdAndStatus(courseId, HumanLearningService.STATUS_INDEXED);
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
            prior.setStatus(HumanLearningService.STATUS_SUPERSEDED);
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

    KnowledgeCandidate requireManagedIndexedCandidate(String candidateId) {
        KnowledgeCandidate candidate = knowledgeCandidateRepository.findById(requireText(candidateId, "id"))
                .orElseThrow(() -> new IllegalArgumentException("Knowledge candidate not found"));
        if (!HumanLearningService.STATUS_INDEXED.equalsIgnoreCase(candidate.getStatus())
                && !HumanLearningService.STATUS_UNINDEXED.equalsIgnoreCase(candidate.getStatus())) {
            throw new IllegalArgumentException(
                    "Chỉ quản lý được knowledge đã duyệt nạp RAG (INDEXED/UNINDEXED). Status hiện tại: "
                            + candidate.getStatus());
        }
        return candidate;
    }

    CourseMaterial loadMaterialForCandidate(KnowledgeCandidate candidate) {
        String materialId = trimToNull(candidate.getMaterialId());
        if (materialId == null) {
            return null;
        }
        return courseMaterialRepository.findById(materialId).orElse(null);
    }

    void rewriteCandidateIndex(KnowledgeCandidate candidate, CourseMaterial material, String content)
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

    static String normalizeQuestionKey(String question) {
        return com.ragapi.util.TextSanitizer.normalizeAccentInsensitive(question);
    }

    void annotateExistingAcademicKnowledge(List<KnowledgeCandidate> candidates) {
        Map<String, List<KnowledgeCandidate>> indexedByCourse = new HashMap<>();
        for (KnowledgeCandidate candidate : candidates) {
            candidate.setExistingAcademicKnowledge(null);
            String courseId = trimToNull(candidate.getCourseId());
            String questionKey = normalizeQuestionKey(candidate.getQuestion());
            if (courseId == null || questionKey.isBlank() || HumanLearningService.STATUS_INDEXED.equals(candidate.getStatus())) {
                continue;
            }
            List<KnowledgeCandidate> indexed = indexedByCourse.computeIfAbsent(
                    courseId,
                    key -> knowledgeCandidateRepository.findByCourseIdAndStatus(key, HumanLearningService.STATUS_INDEXED)
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

    void publishEscalationAnswered(QuestionEscalation escalation) {
        publishEscalationAnswered(escalation, null);
    }

    void publishEscalationAnswered(QuestionEscalation escalation, UserNotification notification) {
        if (escalation == null || escalation.getId() == null) return;
        try {
            Map<String, Object> data = new LinkedHashMap<>();
            data.put("questionEscalationId", escalation.getId());
            data.put("studentId", escalation.getUserId() == null ? "" : escalation.getUserId());
            data.put("courseId", escalation.getCourseId() == null ? "" : escalation.getCourseId());
            data.put("classId", escalation.getClassId() == null ? "" : escalation.getClassId());
            data.put("status", escalation.getStatus() == null ? "" : escalation.getStatus());
            if (notification != null) {
                data.putAll(notifications.realtimePayload(notification));
            }
            String status = escalation.getStatus() == null ? "" : escalation.getStatus();

            if (escalation.getUserId() != null && !escalation.getUserId().isBlank()) {
                realtimeEvents.publishToUser(escalation.getUserId(), "SUPPORT_ESCALATION_ANSWERED",
                        "QUESTION_ESCALATION", escalation.getId(), status, data);
            }
            String teacherId = null;
            if (escalation.getCourseId() != null && escalation.getClassId() != null) {
                teacherId = classSectionRepository
                        .findByCourseIdAndClassId(escalation.getCourseId(), escalation.getClassId())
                        .map(ClassSection::getTeacherId)
                        .filter(id -> id != null && !id.isBlank())
                        .orElse(null);
            }
            if (teacherId != null) {
                realtimeEvents.publishToUser(teacherId, "SUPPORT_ESCALATION_ANSWERED",
                        "QUESTION_ESCALATION", escalation.getId(), status, data);
            }
        } catch (Exception error) {
            log.warn("Could not publish SUPPORT_ESCALATION_ANSWERED for {}: {}",
                    escalation.getId(), error.getMessage());
        }
    }

    void markEscalationIndexed(KnowledgeCandidate candidate) {
        String escalationId = trimToNull(candidate.getQuestionEscalationId());
        if (escalationId == null) {
            return;
        }
        escalationRepository.findById(escalationId).ifPresent(escalation -> {
            escalation.setStatus("RESOLVED_INDEXED");
            escalation.setIdempotencyKey(null);
            escalation.setUpdatedAt(LocalDateTime.now());
            escalationRepository.save(escalation);
            publishEscalationAnswered(escalation);
        });
    }

    void updateEscalationAfterCandidateRejected(KnowledgeCandidate candidate) {
        String escalationId = trimToNull(candidate.getQuestionEscalationId());
        if (escalationId == null) {
            return;
        }
        escalationRepository.findById(escalationId).ifPresent(escalation -> {
            escalation.setStatus("ANSWERED_KNOWLEDGE_REJECTED");
            escalation.setIdempotencyKey(null);
            escalation.setUpdatedAt(LocalDateTime.now());
            escalationRepository.save(escalation);
            publishEscalationAnswered(escalation);
        });
    }

    String toStudentVisibleStatus(String status) {
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

    KnowledgeCandidate buildCandidate(
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
                .status(HumanLearningService.STATUS_PENDING_SENIOR_REVIEW)
                .createdAt(now)
                .updatedAt(now)
                .build();
    }

    void validateCandidateCanBeReviewed(KnowledgeCandidate candidate) {
        if (!HumanLearningService.STATUS_PENDING_SENIOR_REVIEW.equalsIgnoreCase(candidate.getStatus())
                && !HumanLearningService.STATUS_LEGACY_PENDING_REVIEW.equalsIgnoreCase(candidate.getStatus())) {
            throw new IllegalArgumentException("Only pending senior-review candidates can be approved or rejected");
        }
    }

    void requireAssignedTeacher(QuestionEscalation escalation, String teacherId) {
        if (escalation == null
                || escalation.getAssignedMentorId() == null
                || escalation.getAssignedMentorId().isBlank()
                || !matchesTeacherId(teacherId, escalation.getAssignedMentorId())) {
            throw new IllegalArgumentException("Only the mentor selected by the student can access this escalation");
        }
    }

    boolean matchesTeacherId(String requesterTeacherId, String assignedMentorKey) {
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

    void requireEscalationViewer(
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

    void validateSeniorReviewer(KnowledgeCandidate candidate, KnowledgeCandidateReviewRequest request) {
        if (request == null) {
            throw new IllegalArgumentException("review request body is required");
        }
        requireText(request.getReviewerId(), "reviewerId");
        String reviewerRole = requireEnum(request.getReviewerRole(), "reviewerRole", "SENIOR_MENTOR", "ADMIN");
        if (candidate.getTeacherId() != null && candidate.getTeacherId().equals(request.getReviewerId().trim())) {
            throw new IllegalArgumentException("The mentor who answered cannot approve their own knowledge candidate");
        }
    }

    void validateLearnableCandidateType(String candidateType) {
        if (!"ACADEMIC_KNOWLEDGE".equals(candidateType)
                && !"MATERIAL_CORRECTION".equals(candidateType)
                && !"FAQ_CLARIFICATION".equals(candidateType)) {
            throw new IllegalArgumentException("Only ACADEMIC_KNOWLEDGE, MATERIAL_CORRECTION, or FAQ_CLARIFICATION can be indexed into AI Tutor brain");
        }
    }

    String normalizeCandidateType(String candidateType) {
        String normalized = normalizeUpper(candidateType);
        return normalized == null ? "ACADEMIC_KNOWLEDGE" : normalized;
    }

    String trimToNull(String value) {
        return optionalMaxLength(value, "value", SHORT_TEXT_MAX_LENGTH);
    }

    String normalizeUpper(String value) {
        return value == null || value.isBlank() ? null : value.trim().toUpperCase();
    }
}
