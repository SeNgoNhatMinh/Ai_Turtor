package com.ragapi.service;

import com.ragapi.dto.RagQueryIntent;
import com.ragapi.entity.CourseMaterial;
import com.ragapi.entity.ImprovePlan;
import com.ragapi.entity.ImprovePlanItem;
import com.ragapi.entity.StudentCourseMemory;
import com.ragapi.repository.AssignmentSubmissionRepository;
import com.ragapi.repository.CourseMaterialRepository;
import com.ragapi.repository.ImprovePlanRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ImprovePlanServiceTest {

    @Mock
    private ImprovePlanRepository improvePlanRepository;

    @Mock
    private AssignmentSubmissionRepository submissionRepository;

    @Mock
    private CourseMaterialRepository materialRepository;

    private ImprovePlanService service;

    @BeforeEach
    void setUp() {
        service = new ImprovePlanService(
                improvePlanRepository,
                submissionRepository,
                materialRepository,
                new CourseMaterialChunkingService()
        );
    }

    @Test
    void generatePlanKeepsSourceTerminologyAndMaterialProvenance() {
        StudentCourseMemory memory = StudentCourseMemory.builder()
                .studentId("student-1")
                .courseId("OSG202")
                .classId("SE1832")
                .weakTopics(new ArrayList<>(List.of("Allocation")))
                .build();
        CourseMaterial material = textbookMaterial(
                "banker-material",
                "OSG202",
                "SE1832",
                "Banker's Algorithm",
                "Allocation means resources currently assigned to each process. "
                        + "Need means resources still needed before a process can finish."
        );

        when(submissionRepository.findByStudentId("student-1")).thenReturn(List.of());
        when(materialRepository.findByCourseId("OSG202")).thenReturn(List.of(material));
        when(improvePlanRepository.findFirstByStudentIdAndCourseIdAndStatusOrderByGeneratedAtDesc(
                "student-1", "OSG202", "ACTIVE"
        )).thenReturn(Optional.empty());
        when(improvePlanRepository.save(any(ImprovePlan.class))).thenAnswer(invocation -> invocation.getArgument(0));

        ImprovePlan plan = service.generateOrUpdatePlan(memory, "SYSTEM");

        assertThat(plan.getPlanItems()).contains("Ôn lại Allocation và tự giải thích bằng ví dụ nhỏ.");
        assertThat(plan.getPlanItemDetails()).isNotEmpty();
        ImprovePlanItem item = plan.getPlanItemDetails().stream()
                .filter(candidate -> "allocation-review".equals(candidate.getId()))
                .findFirst()
                .orElseThrow();
        assertThat(item.getGroundingStatus()).isEqualTo("GROUNDED");
        assertThat(item.getSourceMaterialIds()).contains("banker-material");
        assertThat(item.getSourceTerms()).anySatisfy(term ->
                assertThat(term).containsIgnoringCase("resources currently assigned"));
        assertThat(item.getRetrievalTerms()).contains("resources currently assigned");
    }

    @Test
    void resolveReviewIntentBuildsRetrievalQueryFromSourceTerms() {
        ImprovePlanItem item = ImprovePlanItem.builder()
                .id("allocation-review")
                .title("Ôn lại Allocation")
                .instruction("Ôn lại Allocation và tự giải thích bằng ví dụ nhỏ.")
                .sourceTopic("Allocation")
                .sourceTerms(List.of("resources currently assigned to each process"))
                .retrievalTerms(List.of("Allocation", "allocated resources"))
                .sourceMaterialIds(List.of("banker-material"))
                .sourceChunkIds(List.of("banker-material:chapter:1:section:1:chunk:0"))
                .build();
        ImprovePlan plan = ImprovePlan.builder()
                .id("plan-1")
                .studentId("student-1")
                .courseId("OSG202")
                .planItemDetails(List.of(item))
                .build();
        when(improvePlanRepository.findById("plan-1")).thenReturn(Optional.of(plan));

        RagQueryIntent intent = service.resolveReviewIntent(
                "student-1", "OSG202", "plan-1", "allocation-review");

        assertThat(intent.getRetrievalQuery()).contains("resources currently assigned");
        assertThat(intent.getRetrievalQuery()).doesNotContain("Ôn tập theo Improve Plan");
        assertThat(intent.getSourceMaterialIds()).containsExactly("banker-material");
        assertThat(intent.getSourceChunkIds()).containsExactly("banker-material:chapter:1:section:1:chunk:0");
    }

    @Test
    void resolveReviewIntentRejectsAnotherStudentsPlan() {
        ImprovePlan plan = ImprovePlan.builder()
                .id("plan-1")
                .studentId("other-student")
                .courseId("OSG202")
                .planItemDetails(List.of(ImprovePlanItem.builder().id("item-1").build()))
                .build();
        when(improvePlanRepository.findById("plan-1")).thenReturn(Optional.of(plan));

        assertThatThrownBy(() -> service.resolveReviewIntent(
                "student-1", "OSG202", "plan-1", "item-1"))
                .isInstanceOf(SecurityException.class);
    }

    private CourseMaterial textbookMaterial(
            String id,
            String courseId,
            String classId,
            String title,
            String content
    ) {
        CourseMaterial material = new CourseMaterial();
        material.setId(id);
        material.setCourseId(courseId);
        material.setClassId(classId);
        material.setTitle(title);
        material.setContent(content);
        material.setSourceType("PDF");
        material.setMaterialScope("CLASS_SECTION");
        material.setUploadedByRole("TEACHER");
        material.setIndexingStatus("INDEXED");
        return material;
    }
}
