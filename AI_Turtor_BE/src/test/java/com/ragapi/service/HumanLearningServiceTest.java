package com.ragapi.service;

import com.ragapi.dto.KnowledgeCandidateReviewRequest;
import com.ragapi.dto.MentorAnswerRequest;
import com.ragapi.entity.CourseMaterial;
import com.ragapi.entity.KnowledgeCandidate;
import com.ragapi.entity.QuestionEscalation;
import com.ragapi.repository.CourseMaterialRepository;
import com.ragapi.repository.KnowledgeCandidateRepository;
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
    void answerEscalationRejectsTeacherWhoWasNotSelectedByStudent() {
        QuestionEscalationRepository escalationRepository = mock(QuestionEscalationRepository.class);
        KnowledgeImageStorageService imageStorageService = mock(KnowledgeImageStorageService.class);
        HumanLearningService service = new HumanLearningService(
                escalationRepository,
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
    void submitTeacherChatAnswerReusesExistingCandidate() {
        QuestionEscalationRepository escalationRepository = mock(QuestionEscalationRepository.class);
        KnowledgeCandidateRepository candidateRepository = mock(KnowledgeCandidateRepository.class);
        HumanLearningService service = new HumanLearningService(
                escalationRepository,
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
