package com.ragapi.service.behavior;

import com.ragapi.dto.AssignTeachingBehaviorRequest;
import com.ragapi.entity.AppliedTeachingBehavior;
import com.ragapi.entity.TeachingBehavior;
import com.ragapi.entity.TeachingBehaviorVersion;
import com.ragapi.repository.AppliedTeachingBehaviorRepository;
import com.ragapi.repository.TeachingBehaviorExecutionRepository;
import com.ragapi.repository.TeachingBehaviorRepository;
import com.ragapi.repository.TeachingBehaviorVersionRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.data.mongodb.core.MongoTemplate;

import java.util.List;
import java.util.Optional;

import static com.ragapi.entity.TeachingBehavior.SCOPE_COURSE;
import static com.ragapi.entity.TeachingBehavior.STATUS_APPROVED;
import static com.ragapi.entity.TeachingBehavior.STATUS_RETIRED;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class AppliedTeachingBehaviorServiceTest {
    private static final BehaviorActor TEACHER = new BehaviorActor("teacher-1", "Cô Lan", "TEACHER");
    private static final BehaviorActor OTHER = new BehaviorActor("teacher-2", "Thầy Nam", "TEACHER");

    @Mock AppliedTeachingBehaviorRepository assignmentRepository;
    @Mock TeachingBehaviorExecutionRepository executionRepository;
    @Mock TeachingBehaviorVersionRepository versionRepository;
    @Mock TeachingBehaviorRepository behaviorRepository;
    @Mock TeachingBehaviorService behaviorService;
    @Mock MongoTemplate mongoTemplate;
    @InjectMocks AppliedTeachingBehaviorService service;

    private TeachingBehavior template;

    @BeforeEach
    void setUp() {
        template = TeachingBehavior.builder()
                .id("b-1").scope(SCOPE_COURSE).courseId("PRO192").status(STATUS_APPROVED)
                .instruction("Ví dụ thực tế: mở bằng tình huống đời thường").version(2).build();
        when(behaviorService.get("b-1", TEACHER)).thenReturn(template);
        when(behaviorService.get("b-1", OTHER)).thenReturn(template);
        when(assignmentRepository.save(any())).thenAnswer(invocation -> invocation.getArgument(0));
        when(behaviorRepository.save(any())).thenAnswer(invocation -> invocation.getArgument(0));
    }

    @Test
    void oneTemplateCanBeAssignedToTwoStudentsButNotTwiceToTheSameStudent() {
        when(assignmentRepository.findByBehaviorId("b-1")).thenReturn(List.of());
        AssignTeachingBehaviorRequest first = request("student-1");
        AssignTeachingBehaviorRequest second = request("student-2");

        AppliedTeachingBehavior saved = service.assign("b-1", first, TEACHER);
        assertThat(saved.getStudentId()).isEqualTo("student-1");
        assertThat(saved.getBehaviorId()).isEqualTo("b-1");

        when(assignmentRepository.findByBehaviorId("b-1")).thenReturn(List.of(saved));
        assertThat(service.assign("b-1", second, TEACHER).getStudentId()).isEqualTo("student-2");

        when(assignmentRepository.findByBehaviorId("b-1")).thenReturn(List.of(saved));
        assertThatThrownBy(() -> service.assign("b-1", first, TEACHER))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("đã được gán");
    }

    @Test
    void teacherCannotAssignOntoACourseTheyDoNotTeach() {
        org.mockito.Mockito.doThrow(new BehaviorAccessDeniedException("Bạn không phụ trách môn này"))
                .when(behaviorService).requireCourseTeacher(OTHER, "PRO192", null);
        when(assignmentRepository.findByBehaviorId("b-1")).thenReturn(List.of());

        assertThatThrownBy(() -> service.assign("b-1", request("student-1"), OTHER))
                .isInstanceOf(BehaviorAccessDeniedException.class);
    }

    @Test
    void retiredTemplateCannotBeAssigned() {
        template.setStatus(STATUS_RETIRED);
        assertThatThrownBy(() -> service.assign("b-1", request("student-1"), TEACHER))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("đã duyệt");
    }

    @Test
    void rollbackRestoresTheOldInstructionAndKeepsANewVersion() {
        when(behaviorService.canEdit(template, TEACHER)).thenReturn(true);
        when(versionRepository.findByBehaviorIdAndVersion("b-1", 1)).thenReturn(Optional.of(
                TeachingBehaviorVersion.builder().behaviorId("b-1").version(1)
                        .instruction("Bản cũ").strategy("Bảng so sánh").build()));

        TeachingBehavior restored = service.rollback("b-1", 1, TEACHER);

        assertThat(restored.getInstruction()).isEqualTo("Bản cũ");
        assertThat(restored.getVersion()).isEqualTo(3);
        verify(behaviorService).snapshot(template, TEACHER.id());
    }

    private static AssignTeachingBehaviorRequest request(String studentId) {
        AssignTeachingBehaviorRequest request = new AssignTeachingBehaviorRequest();
        request.setCourseId("PRO192");
        request.setStudentId(studentId);
        return request;
    }
}
