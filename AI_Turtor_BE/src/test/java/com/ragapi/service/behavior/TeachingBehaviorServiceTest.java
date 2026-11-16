package com.ragapi.service.behavior;

import com.ragapi.dto.TeachingBehaviorRequest;
import com.ragapi.entity.AdaptiveLearningReview;
import com.ragapi.entity.TeachingBehavior;
import com.ragapi.repository.TeachingBehaviorRepository;
import com.ragapi.repository.TeachingBehaviorVersionRepository;
import com.ragapi.service.AccessGuardService;
import com.ragapi.service.EmbeddingService;
import com.ragapi.service.PedagogicalDirectiveService;
import com.ragapi.service.PrivacySanitizer;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.data.mongodb.core.MongoTemplate;

import java.util.ArrayList;
import java.util.List;

import static com.ragapi.entity.TeachingBehavior.*;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class TeachingBehaviorServiceTest {
    private static final BehaviorActor TEACHER = new BehaviorActor("teacher-1", "Cô Lan", "TEACHER");

    @Mock TeachingBehaviorRepository repository;
    @Mock TeachingBehaviorVersionRepository versionRepository;
    @Mock MongoTemplate mongoTemplate;
    @Mock EmbeddingService embeddingService;
    @Mock PrivacySanitizer privacySanitizer;
    @Mock AccessGuardService accessGuard;
    @InjectMocks TeachingBehaviorService service;

    @BeforeEach
    void setUp() {
        when(embeddingService.generatePassageEmbedding(anyString())).thenThrow(new IllegalStateException("offline"));
        when(privacySanitizer.sanitize(anyString())).thenAnswer(invocation -> invocation.getArgument(0));
        when(accessGuard.isTeacher("TEACHER")).thenReturn(true);
        when(repository.save(any(TeachingBehavior.class))).thenAnswer(invocation -> invocation.getArgument(0));
    }

    private static AdaptiveLearningReview review() {
        return AdaptiveLearningReview.builder()
                .id("rev-1").studentId("student-1").courseId("PRO192").classId("SE1833")
                .suggestedSupportLevel("HIGH_SUPPORT")
                .teachingRecommendations(List.of("Dùng ví dụ con vật", "Thêm câu kiểm tra ngắn"))
                .knowledgeGaps(List.of("đa hình"))
                .build();
    }

    private static TeachingBehavior pending(String id, String instruction) {
        return TeachingBehavior.builder().id(id).scope(SCOPE_STUDENT).studentId("student-1").courseId("PRO192")
                .instruction(instruction).status(STATUS_AI_PENDING).sourceReviewId("rev-1")
                .createdBy(PedagogicalDirectiveService.AI_ACTOR_ID).build();
    }

    @Test
    void pendingReviewSupersedesOlderAiStrategiesAndCreatesOnePerRecommendation() {
        TeachingBehavior older = pending("old", "Cách cũ");
        when(repository.findByScopeAndStudentIdAndCourseIdAndStatusIn(
                SCOPE_STUDENT, "student-1", "PRO192", List.of(STATUS_AI_PENDING))).thenReturn(List.of(older));

        List<TeachingBehavior> created = service.createPendingFromReview(review());

        assertThat(older.getStatus()).isEqualTo(STATUS_RETIRED);
        assertThat(created).extracting(TeachingBehavior::getInstruction)
                .containsExactly("Dùng ví dụ con vật", "Thêm câu kiểm tra ngắn");
        assertThat(created).allSatisfy(behavior -> {
            assertThat(behavior.getStatus()).isEqualTo(STATUS_AI_PENDING);
            assertThat(behavior.getScope()).isEqualTo(SCOPE_STUDENT);
            assertThat(behavior.getSupportLevels()).containsExactly("HIGH_SUPPORT");
            assertThat(behavior.getTargetSignals()).contains("đa hình");
        });
    }

    @Test
    void approveKeepsCheckedRejectsUncheckedAndAddsOther() {
        TeachingBehavior animal = pending("b-1", "Dùng ví dụ con vật");
        TeachingBehavior quiz = pending("b-2", "Thêm câu kiểm tra ngắn");
        when(repository.findBySourceReviewId("rev-1")).thenReturn(List.of(animal, quiz));

        List<TeachingBehavior> approved = service.approveReviewBehaviors(
                review(), List.of("Dùng ví dụ con vật"), "So sánh với Java", TEACHER);

        assertThat(animal.getStatus()).isEqualTo(STATUS_APPROVED);
        assertThat(quiz.getStatus()).isEqualTo(STATUS_REJECTED);
        assertThat(approved).extracting(TeachingBehavior::getInstruction)
                .containsExactly("Dùng ví dụ con vật", "So sánh với Java");
        assertThat(approved.get(1).getCreatedBy()).isEqualTo("teacher-1");
    }

    @Test
    void approveWithoutChoiceKeepsEverySuggestion() {
        when(repository.findBySourceReviewId("rev-1"))
                .thenReturn(List.of(pending("b-1", "Dùng ví dụ con vật"), pending("b-2", "Thêm câu kiểm tra ngắn")));

        List<TeachingBehavior> approved = service.approveReviewBehaviors(review(), null, null, TEACHER);

        assertThat(approved).hasSize(2).allMatch(behavior -> STATUS_APPROVED.equals(behavior.getStatus()));
    }

    @Test
    void rejectRemovesEveryStrategyFromTheReview() {
        TeachingBehavior animal = pending("b-1", "Dùng ví dụ con vật");
        TeachingBehavior approvedEarlier = pending("b-2", "Thêm câu kiểm tra ngắn");
        approvedEarlier.setStatus(STATUS_APPROVED);
        when(repository.findBySourceReviewId("rev-1")).thenReturn(List.of(animal, approvedEarlier));

        service.rejectReviewBehaviors("rev-1");

        assertThat(animal.getStatus()).isEqualTo(STATUS_REJECTED);
        assertThat(approvedEarlier.getStatus()).isEqualTo(STATUS_REJECTED);
    }

    @Test
    void sharingStripsTheStudentsNameAndDeduplicatesInTheDomain() {
        TeachingBehavior source = pending("b-1", "Cho Nguyễn Văn An xem ví dụ con vật");
        source.setTargetSignals(new ArrayList<>(List.of("An hay nhầm overload")));
        TeachingBehavior existing = TeachingBehavior.builder().id("d-1").scope(SCOPE_DOMAIN).domain("OOP")
                .status(STATUS_APPROVED).instruction("Dùng bảng so sánh").useCount(3).build();
        when(repository.findTop500ByScopeAndDomainAndStatus(SCOPE_DOMAIN, "OOP", STATUS_APPROVED))
                .thenReturn(List.of(existing));

        List<TeachingBehavior> shared = service.shareBehaviors(List.of(source), "DOMAIN", "oop", "PRO192",
                List.of("Nguyễn Văn An", "An"), TEACHER);

        assertThat(shared).hasSize(1);
        TeachingBehavior copy = shared.get(0);
        assertThat(copy.getScope()).isEqualTo(SCOPE_DOMAIN);
        assertThat(copy.getDomain()).isEqualTo("OOP");
        assertThat(copy.getStudentId()).isNull();
        assertThat(copy.getInstruction()).doesNotContain("An").contains("sinh viên");
        assertThat(copy.getTargetSignals()).noneMatch(signal -> signal.contains("An "));
        assertThat(copy.getSourceBehaviorId()).isEqualTo("b-1");
    }

    @Test
    void creatingTheSameSharedBehaviorReinforcesTheExistingOne() {
        TeachingBehavior existing = TeachingBehavior.builder().id("g-1").scope(SCOPE_GLOBAL)
                .status(STATUS_APPROVED).instruction("Khen ngợi khi làm đúng").useCount(3).build();
        when(repository.findTop500ByScopeAndStatus(SCOPE_GLOBAL, STATUS_APPROVED)).thenReturn(List.of(existing));
        TeachingBehaviorRequest request = new TeachingBehaviorRequest();
        request.setScope("global");
        request.setInstruction("  khen ngợi   khi làm đúng ");

        TeachingBehavior saved = service.create(request, TEACHER);

        assertThat(saved.getId()).isEqualTo("g-1");
        assertThat(saved.getUseCount()).isEqualTo(4);
    }

    @Test
    void domainScopeRequiresAKnownDomain() {
        TeachingBehaviorRequest request = new TeachingBehaviorRequest();
        request.setScope("DOMAIN");
        request.setDomain("COOKING");
        request.setInstruction("Dùng ví dụ");

        assertThatThrownBy(() -> service.create(request, TEACHER)).isInstanceOf(IllegalArgumentException.class);
        verify(repository, never()).save(any());
    }

    @Test
    void studentCannotCreateBehaviors() {
        TeachingBehaviorRequest request = new TeachingBehaviorRequest();
        request.setScope("GLOBAL");
        request.setInstruction("Dùng ví dụ");

        assertThatThrownBy(() -> service.create(request, new BehaviorActor("s-1", "SV", "STUDENT")))
                .isInstanceOf(BehaviorAccessDeniedException.class);
    }

    @Test
    void behaviorThatKeepsFailingIsRetired() {
        TeachingBehavior behavior = TeachingBehavior.builder().id("b-1").status(STATUS_APPROVED)
                .outcomeCount(9).successRate(0.31).build();
        when(repository.findAllById(any())).thenReturn(List.of(behavior));

        service.recordOutcome(List.of("b-1"), false);

        ArgumentCaptor<TeachingBehavior> captor = ArgumentCaptor.forClass(TeachingBehavior.class);
        verify(repository).save(captor.capture());
        assertThat(captor.getValue().getOutcomeCount()).isEqualTo(10);
        assertThat(captor.getValue().getSuccessRate()).isLessThan(0.3);
        assertThat(captor.getValue().getStatus()).isEqualTo(STATUS_RETIRED);
        verify(repository, never()).findByScopeAndStudentIdAndCourseIdAndStatusIn(any(), any(), any(), anyCollection());
        verifyNoInteractions(mongoTemplate);
        verify(accessGuard, never()).allowTeacherForCourseOrAdmin(any(), any(), eq("x"));
    }
}
