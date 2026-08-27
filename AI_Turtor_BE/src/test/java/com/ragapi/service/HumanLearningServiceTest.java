package com.ragapi.service;

import com.ragapi.dto.KnowledgeCandidateReviewRequest;
import com.ragapi.dto.MentorAnswerRequest;
import com.ragapi.entity.CourseMaterial;
import com.ragapi.entity.KnowledgeCandidate;
import com.ragapi.entity.Mentor;
import com.ragapi.entity.QuestionEscalation;
import com.ragapi.repository.CourseMaterialRepository;
import com.ragapi.repository.KnowledgeCandidateRepository;
import com.ragapi.repository.MentorRepository;
import com.ragapi.repository.MentorAnswerRepository;
import com.ragapi.repository.QuestionEscalationRepository;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class HumanLearningServiceTest {

    @Test
    void approveCandidateIndexesProvenanceAndLinksMaterial() throws Exception {
        QuestionEscalationRepository escalationRepository = mock(QuestionEscalationRepository.class);
        MentorAnswerRepository mentorAnswerRepository = mock(MentorAnswerRepository.class);
        KnowledgeCandidateRepository candidateRepository = mock(KnowledgeCandidateRepository.class);
        CourseMaterialRepository materialRepository = mock(CourseMaterialRepository.class);
        CourseMaterialChunkingService chunkingService = mock(CourseMaterialChunkingService.class);
        ElasticVectorService vectorService = mock(ElasticVectorService.class);
        CanonicalTutorAnswerCacheService answerCacheService = mock(CanonicalTutorAnswerCacheService.class);
        HumanLearningService service = new HumanLearningService(
                escalationRepository,
                mock(MentorRepository.class),
                mentorAnswerRepository,
                candidateRepository,
                materialRepository,
                chunkingService,
                vectorService,
                mock(KnowledgeImageStorageService.class),
                answerCacheService
        );
        KnowledgeCandidate candidate = KnowledgeCandidate.builder()
                .id("candidate-1")
                .courseId("PRJ301")
                .teacherId("teacher-1")
                .candidateType("ACADEMIC_KNOWLEDGE")
                .question("Servlet lifecycle là gì?")
                .answer("Servlet có các pha init, service và destroy.")
                .status("PENDING_SENIOR_REVIEW")
                .build();
        when(candidateRepository.findById("candidate-1")).thenReturn(Optional.of(candidate));
        when(materialRepository.save(any(CourseMaterial.class))).thenAnswer(invocation -> {
            CourseMaterial material = invocation.getArgument(0);
            if (material.getId() == null) {
                material.setId("material-1");
            }
            return material;
        });
        when(chunkingService.chunk(any())).thenReturn(List.of("approved chunk"));
        when(candidateRepository.save(any(KnowledgeCandidate.class))).thenAnswer(invocation -> invocation.getArgument(0));

        KnowledgeCandidateReviewRequest request = new KnowledgeCandidateReviewRequest();
        request.setReviewerId("senior-1");
        request.setReviewerRole("SENIOR_MENTOR");
        request.setReviewerName("Senior Mentor");

        KnowledgeCandidate approved = service.approveCandidate("candidate-1", request);

        assertThat(approved.getMaterialId()).isEqualTo("material-1");
        assertThat(approved.getStatus()).isEqualTo("INDEXED");
        ArgumentCaptor<CourseMaterial> materialCaptor = ArgumentCaptor.forClass(CourseMaterial.class);
        verify(materialRepository, org.mockito.Mockito.atLeastOnce()).save(materialCaptor.capture());
        CourseMaterial material = materialCaptor.getAllValues().get(0);
        assertThat(material.getKnowledgeCandidateId()).isEqualTo("candidate-1");
        assertThat(material.getSourceType()).isEqualTo("KNOWLEDGE_CANDIDATE");
        verify(vectorService).indexChunks(
                "PRJ301",
                null,
                "senior-1",
                "material-1",
                "COURSE_SHARED",
                "KNOWLEDGE_CANDIDATE",
                null,
                null,
                List.of("approved chunk")
        );
        verify(answerCacheService).evictRagAnswersForCourse("PRJ301");
    }

    @Test
    void approveCandidateSupersedesNearDuplicateIndexedQuestion() throws Exception {
        QuestionEscalationRepository escalationRepository = mock(QuestionEscalationRepository.class);
        KnowledgeCandidateRepository candidateRepository = mock(KnowledgeCandidateRepository.class);
        CourseMaterialRepository materialRepository = mock(CourseMaterialRepository.class);
        CourseMaterialChunkingService chunkingService = mock(CourseMaterialChunkingService.class);
        ElasticVectorService vectorService = mock(ElasticVectorService.class);
        CanonicalTutorAnswerCacheService answerCacheService = mock(CanonicalTutorAnswerCacheService.class);
        HumanLearningService service = new HumanLearningService(
                escalationRepository,
                mock(MentorRepository.class),
                mock(MentorAnswerRepository.class),
                candidateRepository,
                materialRepository,
                chunkingService,
                vectorService,
                mock(KnowledgeImageStorageService.class),
                answerCacheService
        );
        KnowledgeCandidate prior = KnowledgeCandidate.builder()
                .id("old-candidate")
                .courseId("PFP191")
                .question("pytorch la gi")
                .status("INDEXED")
                .materialId("mat-old")
                .reviewNote("ok")
                .build();
        KnowledgeCandidate candidate = KnowledgeCandidate.builder()
                .id("candidate-2")
                .courseId("PFP191")
                .teacherId("teacher-1")
                .candidateType("ACADEMIC_KNOWLEDGE")
                .question("pytorch là gì ?")
                .answer("PyTorch là thư viện học sâu.")
                .status("PENDING_SENIOR_REVIEW")
                .build();
        when(candidateRepository.findById("candidate-2")).thenReturn(Optional.of(candidate));
        when(candidateRepository.findByCourseIdAndStatus("PFP191", "INDEXED")).thenReturn(List.of(prior));
        when(materialRepository.save(any(CourseMaterial.class))).thenAnswer(invocation -> {
            CourseMaterial material = invocation.getArgument(0);
            if (material.getId() == null) {
                material.setId("material-2");
            }
            return material;
        });
        when(chunkingService.chunk(any())).thenReturn(List.of("approved chunk"));
        when(candidateRepository.save(any(KnowledgeCandidate.class))).thenAnswer(invocation -> invocation.getArgument(0));

        KnowledgeCandidateReviewRequest request = new KnowledgeCandidateReviewRequest();
        request.setReviewerId("senior-1");
        request.setReviewerRole("SENIOR_MENTOR");
        request.setReviewerName("Senior Mentor");

        service.approveCandidate("candidate-2", request);

        assertThat(prior.getStatus()).isEqualTo("SUPERSEDED");
        verify(vectorService).deleteChunksByMaterialId("mat-old");
        verify(materialRepository).deleteById("mat-old");
    }

    @Test
    void listCandidatesAnnotatesPendingDuplicateOfIndexedQuestion() {
        KnowledgeCandidateRepository candidateRepository = mock(KnowledgeCandidateRepository.class);
        HumanLearningService service = new HumanLearningService(
                mock(QuestionEscalationRepository.class),
                mock(MentorRepository.class),
                mock(MentorAnswerRepository.class),
                candidateRepository,
                mock(CourseMaterialRepository.class),
                mock(CourseMaterialChunkingService.class),
                mock(ElasticVectorService.class),
                mock(KnowledgeImageStorageService.class),
                mock(CanonicalTutorAnswerCacheService.class)
        );
        KnowledgeCandidate pending = KnowledgeCandidate.builder()
                .id("pending-1")
                .courseId("PFP191")
                .question("pytorch là gì?")
                .status("PENDING_SENIOR_REVIEW")
                .build();
        KnowledgeCandidate indexed = KnowledgeCandidate.builder()
                .id("indexed-1")
                .courseId("PFP191")
                .question("pytorch la gi")
                .answer("Đáp án cũ")
                .status("INDEXED")
                .indexedAt(java.time.LocalDateTime.now())
                .build();
        when(candidateRepository.findByStatus("PENDING_SENIOR_REVIEW")).thenReturn(List.of(pending));
        when(candidateRepository.findByCourseIdAndStatus("PFP191", "INDEXED")).thenReturn(List.of(indexed));

        List<KnowledgeCandidate> listed = service.listCandidates("PENDING_SENIOR_REVIEW", "PFP191");

        assertThat(listed).hasSize(1);
        assertThat(listed.get(0).getExistingAcademicKnowledge()).isNotNull();
        assertThat(listed.get(0).getExistingAcademicKnowledge().getId()).isEqualTo("indexed-1");
        assertThat(listed.get(0).getExistingAcademicKnowledge().getAnswer()).isEqualTo("Đáp án cũ");
    }

    @Test
    void answerEscalationRejectsTeacherWhoWasNotSelectedByStudent() {
        QuestionEscalationRepository escalationRepository = mock(QuestionEscalationRepository.class);
        KnowledgeImageStorageService imageStorageService = mock(KnowledgeImageStorageService.class);
        HumanLearningService service = new HumanLearningService(
                escalationRepository,
                mock(MentorRepository.class),
                mock(MentorAnswerRepository.class),
                mock(KnowledgeCandidateRepository.class),
                mock(CourseMaterialRepository.class),
                mock(CourseMaterialChunkingService.class),
                mock(ElasticVectorService.class),
                imageStorageService,
                mock(CanonicalTutorAnswerCacheService.class)
        );
        QuestionEscalation escalation = QuestionEscalation.builder()
                .id("escalation-1")
                .userId("student-1")
                .assignedMentorId("mentor-selected")
                .build();
        when(escalationRepository.findById("escalation-1")).thenReturn(Optional.of(escalation));
        when(imageStorageService.resolveAttachments(any())).thenReturn(List.of());
        MentorAnswerRequest request = new MentorAnswerRequest();
        request.setTeacherId("mentor-other");
        request.setAnswer("Câu trả lời không được phép ghi vào ticket này.");

        assertThatThrownBy(() -> service.answerEscalation("escalation-1", request))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("selected by the student");
    }

    @Test
    void hideEscalationOnlyMarksTeacherInboxAndKeepsEscalation() {
        QuestionEscalationRepository escalationRepository = mock(QuestionEscalationRepository.class);
        HumanLearningService service = new HumanLearningService(
                escalationRepository,
                mock(MentorRepository.class),
                mock(MentorAnswerRepository.class),
                mock(KnowledgeCandidateRepository.class),
                mock(CourseMaterialRepository.class),
                mock(CourseMaterialChunkingService.class),
                mock(ElasticVectorService.class),
                mock(KnowledgeImageStorageService.class),
                mock(CanonicalTutorAnswerCacheService.class)
        );
        QuestionEscalation escalation = QuestionEscalation.builder()
                .id("escalation-1")
                .userId("student-1")
                .assignedMentorId("teacher-1")
                .status("COMPLETED")
                .build();
        when(escalationRepository.findById("escalation-1")).thenReturn(Optional.of(escalation));

        service.hideEscalationFromTeacherInbox("escalation-1", "teacher-1");

        assertThat(escalation.getHiddenFromMentorInboxAt()).isNotNull();
        assertThat(escalation.getUserId()).isEqualTo("student-1");
        verify(escalationRepository).save(escalation);
        verify(escalationRepository, org.mockito.Mockito.never()).delete(any());
    }

    @Test
    void hideEscalationAcceptsMentorCodeForTheSameTeacherAccount() {
        QuestionEscalationRepository escalationRepository = mock(QuestionEscalationRepository.class);
        MentorRepository mentorRepository = mock(MentorRepository.class);
        HumanLearningService service = new HumanLearningService(
                escalationRepository,
                mentorRepository,
                mock(MentorAnswerRepository.class),
                mock(KnowledgeCandidateRepository.class),
                mock(CourseMaterialRepository.class),
                mock(CourseMaterialChunkingService.class),
                mock(ElasticVectorService.class),
                mock(KnowledgeImageStorageService.class),
                mock(CanonicalTutorAnswerCacheService.class)
        );
        Mentor mentor = Mentor.builder().id("mentor-db-id").mentorCode("GV001").build();
        QuestionEscalation escalation = QuestionEscalation.builder()
                .id("escalation-legacy")
                .userId("student-1")
                .assignedMentorId("GV001")
                .status("COMPLETED")
                .build();
        when(escalationRepository.findById("escalation-legacy")).thenReturn(Optional.of(escalation));
        when(mentorRepository.findById("mentor-db-id")).thenReturn(Optional.of(mentor));
        when(mentorRepository.findById("GV001")).thenReturn(Optional.empty());
        when(mentorRepository.findByMentorCode("GV001")).thenReturn(Optional.of(mentor));

        service.hideEscalationFromTeacherInbox("escalation-legacy", "mentor-db-id");

        assertThat(escalation.getHiddenFromMentorInboxAt()).isNotNull();
        verify(escalationRepository).save(escalation);
    }

    @Test
    void submitTeacherChatAnswerReusesExistingCandidate() {
        QuestionEscalationRepository escalationRepository = mock(QuestionEscalationRepository.class);
        KnowledgeCandidateRepository candidateRepository = mock(KnowledgeCandidateRepository.class);
        HumanLearningService service = new HumanLearningService(
                escalationRepository,
                mock(MentorRepository.class),
                mock(MentorAnswerRepository.class),
                candidateRepository,
                mock(CourseMaterialRepository.class),
                mock(CourseMaterialChunkingService.class),
                mock(ElasticVectorService.class),
                mock(KnowledgeImageStorageService.class),
                mock(CanonicalTutorAnswerCacheService.class)
        );
        QuestionEscalation escalation = QuestionEscalation.builder()
                .id("escalation-1")
                .chatRoomId("ROOM-1")
                .assignedMentorId("teacher-1")
                .courseId("PFP191")
                .build();
        KnowledgeCandidate existing = KnowledgeCandidate.builder()
                .id("candidate-1")
                .status("PENDING_SENIOR_REVIEW")
                .build();
        when(escalationRepository.findByChatRoomId("ROOM-1")).thenReturn(Optional.of(escalation));
        when(candidateRepository.findByQuestionEscalationId("escalation-1")).thenReturn(List.of(existing));
        MentorAnswerRequest request = new MentorAnswerRequest();
        request.setTeacherId("teacher-1");
        request.setAnswer("PyTorch là thư viện học sâu.");

        var result = service.submitTeacherChatAnswerAndCandidate("ROOM-1", request);

        assertThat(result.get("alreadyExists")).isEqualTo(true);
        assertThat(result.get("knowledgeCandidateCreated")).isEqualTo(false);
        assertThat(result.get("candidateId")).isEqualTo("candidate-1");
    }
}
