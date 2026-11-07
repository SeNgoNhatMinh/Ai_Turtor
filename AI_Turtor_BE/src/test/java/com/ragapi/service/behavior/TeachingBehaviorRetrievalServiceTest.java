package com.ragapi.service.behavior;

import com.ragapi.entity.AppliedTeachingBehavior;
import com.ragapi.entity.StudentTeachingProfile;
import com.ragapi.entity.TeachingBehavior;
import com.ragapi.repository.TeachingBehaviorRepository;
import com.ragapi.service.EmbeddingService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import static com.ragapi.entity.TeachingBehavior.*;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class TeachingBehaviorRetrievalServiceTest {
    private static final String STUDENT = "student-1";
    private static final String OTHER_STUDENT = "student-2";
    private static final String COURSE = "PRO192";
    private static final String CLASS = "SE1833";

    @Mock TeachingBehaviorRepository repository;
    @Mock StudentTeachingProfileService profileService;
    @Mock TeachingBehaviorService behaviorService;
    @Mock AppliedTeachingBehaviorService appliedService;
    @Mock EmbeddingService embeddingService;
    @InjectMocks TeachingBehaviorRetrievalService retrieval;

    private final List<TeachingBehavior> personal = new ArrayList<>();
    private final List<TeachingBehavior> course = new ArrayList<>();
    private final List<TeachingBehavior> domain = new ArrayList<>();
    private final List<TeachingBehavior> global = new ArrayList<>();

    @BeforeEach
    void setUp() {
        // No embedding provider in unit tests: retrieval falls back to lexical matching.
        when(embeddingService.generateQueryEmbedding(anyString())).thenThrow(new IllegalStateException("offline"));
        when(repository.findByScopeAndStudentIdAndCourseIdAndStatusIn(eq(SCOPE_STUDENT), eq(STUDENT), eq(COURSE), anyCollection()))
                .thenReturn(personal);
        when(repository.findTop500ByScopeAndCourseIdAndStatus(SCOPE_COURSE, COURSE, STATUS_APPROVED)).thenReturn(course);
        when(repository.findTop500ByScopeAndDomainAndStatus(SCOPE_DOMAIN, "OOP", STATUS_APPROVED)).thenReturn(domain);
        when(repository.findTop500ByScopeAndStatus(SCOPE_GLOBAL, STATUS_APPROVED)).thenReturn(global);
        when(profileService.find(STUDENT, COURSE)).thenReturn(Optional.empty());
        when(appliedService.activeFor(anyString(), anyString(), any())).thenReturn(List.of());
    }

    private static TeachingBehavior behavior(String id, String scope, String status, String instruction, String... levels) {
        return TeachingBehavior.builder()
                .id(id).scope(scope).status(status).instruction(instruction)
                .studentId(SCOPE_STUDENT.equals(scope) ? STUDENT : null)
                .courseId(SCOPE_STUDENT.equals(scope) || SCOPE_COURSE.equals(scope) ? COURSE : null)
                .domain(SCOPE_DOMAIN.equals(scope) ? "OOP" : null)
                .supportLevels(new ArrayList<>(List.of(levels)))
                .build();
    }

    @Test
    void pendingStudentStyleIsNotAppliedBeforeTeacherApproval() {
        personal.add(behavior("p-1", SCOPE_STUDENT, STATUS_AI_PENDING, "Giải thích đa hình bằng ví dụ con vật"));
        domain.add(behavior("d-1", SCOPE_DOMAIN, STATUS_APPROVED, "So sánh đa hình với điều khiển từ xa"));
        global.add(behavior("g-1", SCOPE_GLOBAL, STATUS_APPROVED, "Dùng bảng so sánh SQL join"));

        var guidance = retrieval.retrieve(STUDENT, COURSE, CLASS, "STANDARD", "đa hình là gì", "oop", true);

        assertThat(guidance.behaviorIds()).containsExactly("d-1");
        assertThat(guidance.promptBlock()).contains("TEACHING BEHAVIORS TO APPLY")
                .contains("điều khiển từ xa")
                .doesNotContain("ví dụ con vật");
        verify(behaviorService).recordUsage(List.of("d-1"));
        verify(profileService).recordUsage(STUDENT, COURSE, CLASS, List.of("d-1"));
    }

    @Test
    void approvedStudentStyleIsAppliedInChat() {
        personal.add(behavior("p-1", SCOPE_STUDENT, STATUS_APPROVED, "Giải thích đa hình bằng ví dụ con vật"));

        var guidance = retrieval.retrieve(STUDENT, COURSE, CLASS, "STANDARD", "đa hình là gì", "oop", false);

        assertThat(guidance.behaviorIds()).contains("p-1");
        assertThat(guidance.promptBlock()).contains("ví dụ con vật");
    }

    @Test
    void activeAssignmentIsAppliedAndADifferentStudentKeepsTheirOwn() {
        TeachingBehavior template = behavior("c-1", SCOPE_COURSE, STATUS_APPROVED, "Ví dụ thực tế: mở bằng tình huống đời thường");
        template.setVersion(3);
        template.setStrategy("Ví dụ thực tế");
        AppliedTeachingBehavior mine = AppliedTeachingBehavior.builder()
                .id("as-1").behaviorId("c-1").courseId(COURSE).studentId(STUDENT)
                .customizedInstructions("Ví dụ thực tế: dùng ví dụ máy tính tiền").status("ACTIVE").build();
        when(appliedService.activeFor(STUDENT, COURSE, any())).thenReturn(List.of(mine));
        when(appliedService.activeFor(OTHER_STUDENT, COURSE, any())).thenReturn(List.of());
        when(repository.findById("c-1")).thenReturn(Optional.of(template));
        when(repository.findByScopeAndStudentIdAndCourseIdAndStatusIn(eq(SCOPE_STUDENT), eq(OTHER_STUDENT), eq(COURSE), anyCollection()))
                .thenReturn(List.of());
        when(profileService.find(OTHER_STUDENT, COURSE)).thenReturn(Optional.empty());

        var first = retrieval.retrieve(STUDENT, COURSE, CLASS, "STANDARD", "hàm void", null, true);
        var second = retrieval.retrieve(OTHER_STUDENT, COURSE, CLASS, "STANDARD", "hàm void", null, false);

        assertThat(first.promptBlock()).contains("máy tính tiền");
        assertThat(second.promptBlock()).doesNotContain("máy tính tiền");
        verify(appliedService).recordRetrieval(eq(STUDENT), eq(COURSE), eq(CLASS), anyList(), eq(List.of(mine)));
    }

    @Test
    void sameLevelStudentsGetDifferentBehaviorsFromTheirProfiles() {
        course.add(behavior("c-analogy", SCOPE_COURSE, STATUS_APPROVED, "Dùng ví dụ đời thường trước khi đưa code", "HIGH_SUPPORT"));
        course.add(behavior("c-code", SCOPE_COURSE, STATUS_APPROVED, "Đưa đoạn code ngắn rồi giải thích từng dòng code", "HIGH_SUPPORT"));
        when(profileService.find(STUDENT, COURSE)).thenReturn(Optional.of(StudentTeachingProfile.builder()
                .learnsBestWith(List.of("ví dụ đời thường")).build()));
        when(repository.findByScopeAndStudentIdAndCourseIdAndStatusIn(eq(SCOPE_STUDENT), eq(OTHER_STUDENT), eq(COURSE), anyCollection()))
                .thenReturn(List.of());
        when(profileService.find(OTHER_STUDENT, COURSE)).thenReturn(Optional.of(StudentTeachingProfile.builder()
                .learnsBestWith(List.of("đọc code từng dòng")).build()));

        var first = retrieval.retrieve(STUDENT, COURSE, CLASS, "HIGH_SUPPORT", null, null, false);
        var second = retrieval.retrieve(OTHER_STUDENT, COURSE, CLASS, "HIGH_SUPPORT", null, null, false);

        assertThat(first.behaviorIds().get(0)).isEqualTo("c-analogy");
        assertThat(second.behaviorIds().get(0)).isEqualTo("c-code");
        assertThat(first.promptBlock()).contains("STUDENT LEARNING PROFILE").contains("ví dụ đời thường");
        verify(behaviorService, never()).recordUsage(anyList());
    }

    @Test
    void blockedNeverAppearsAndPinnedAlwaysAppears() {
        personal.add(behavior("p-blocked", SCOPE_STUDENT, STATUS_APPROVED, "Giải thích đa hình chậm"));
        TeachingBehavior pinned = behavior("g-pinned", SCOPE_GLOBAL, STATUS_APPROVED, "Khen ngợi khi làm đúng", "CHALLENGE");
        when(profileService.find(STUDENT, COURSE)).thenReturn(Optional.of(StudentTeachingProfile.builder()
                .pinnedBehaviorIds(List.of("g-pinned"))
                .blockedBehaviorIds(List.of("p-blocked"))
                .build()));
        when(repository.findAllById(List.of("g-pinned"))).thenReturn(List.of(pinned));

        // Pinned behaviors apply even outside their support levels.
        var guidance = retrieval.retrieve(STUDENT, COURSE, CLASS, "STANDARD", "đa hình", null, false);

        assertThat(guidance.behaviorIds()).containsExactly("g-pinned");
    }

    @Test
    void ignoresRejectedSharedPendingAndWrongLevelBehaviors() {
        personal.add(behavior("p-rejected", SCOPE_STUDENT, STATUS_REJECTED, "Giải thích đa hình"));
        course.add(behavior("c-pending", SCOPE_COURSE, STATUS_AI_PENDING, "Giải thích đa hình"));
        course.add(behavior("c-level", SCOPE_COURSE, STATUS_APPROVED, "Giải thích đa hình", "CHALLENGE"));

        var guidance = retrieval.retrieve(STUDENT, COURSE, CLASS, "STANDARD", "đa hình", null, false);

        assertThat(guidance.behaviorIds()).isEmpty();
        assertThat(guidance.promptBlock()).isEmpty();
    }

    @Test
    void anotherStudentsPersonalBehaviorIsNeverRetrieved() {
        TeachingBehavior foreign = behavior("p-foreign", SCOPE_STUDENT, STATUS_APPROVED, "Giải thích đa hình");
        foreign.setStudentId(OTHER_STUDENT);
        when(profileService.find(STUDENT, COURSE)).thenReturn(Optional.of(StudentTeachingProfile.builder()
                .pinnedBehaviorIds(List.of("p-foreign")).build()));
        when(repository.findAllById(any())).thenReturn(List.of(foreign));

        var guidance = retrieval.retrieve(STUDENT, COURSE, CLASS, "STANDARD", "đa hình", null, false);

        assertThat(guidance.behaviorIds()).doesNotContain("p-foreign");
    }

    @Test
    void capsAtFiveWithAtMostThreeRanked() {
        for (int index = 0; index < 6; index++) {
            personal.add(behavior("p-" + index, SCOPE_STUDENT, STATUS_APPROVED, "Giải thích đa hình cách " + index));
        }
        when(profileService.find(STUDENT, COURSE)).thenReturn(Optional.of(StudentTeachingProfile.builder()
                .pinnedBehaviorIds(List.of("g-1")).build()));
        when(repository.findAllById(List.of("g-1")))
                .thenReturn(List.of(behavior("g-1", SCOPE_GLOBAL, STATUS_APPROVED, "Khen ngợi")));

        var guidance = retrieval.retrieve(STUDENT, COURSE, CLASS, "STANDARD", "đa hình", null, false);

        assertThat(guidance.behaviorIds()).hasSize(4).startsWith("g-1");
    }
}
