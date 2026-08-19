package com.ragapi.service;

import com.ragapi.dto.KnowledgeCandidateReviewRequest;
import com.ragapi.entity.CourseMaterial;
import com.ragapi.entity.KnowledgeCandidate;
import com.ragapi.repository.CourseMaterialRepository;
import com.ragapi.repository.KnowledgeCandidateRepository;
import com.ragapi.repository.MentorAnswerRepository;
import com.ragapi.repository.QuestionEscalationRepository;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
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
        AiConversationService conversationService = mock(AiConversationService.class);
        HumanLearningService service = new HumanLearningService(
                escalationRepository,
                mentorAnswerRepository,
                candidateRepository,
                materialRepository,
                chunkingService,
                vectorService,
                conversationService,
                mock(KnowledgeImageStorageService.class)
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
    }
}
