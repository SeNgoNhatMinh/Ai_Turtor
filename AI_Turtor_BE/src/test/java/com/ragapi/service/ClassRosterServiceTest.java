package com.ragapi.service;

import com.ragapi.entity.CourseEnrollment;
import com.ragapi.entity.User;
import com.ragapi.repository.CourseEnrollmentRepository;
import com.ragapi.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class ClassRosterServiceTest {

    private UserRepository userRepository;
    private CourseEnrollmentRepository enrollmentRepository;
    private ClassRosterService service;

    @BeforeEach
    void setUp() {
        userRepository = mock(UserRepository.class);
        enrollmentRepository = mock(CourseEnrollmentRepository.class);
        service = new ClassRosterService(userRepository, enrollmentRepository);
    }

    @Test
    void fillsBlankNameAndEmailFromUserAccount() {
        CourseEnrollment enrollment = CourseEnrollment.builder()
                .studentId("user-1")
                .courseId("PRJ301")
                .classId("SE1832")
                .build();
        when(userRepository.findById("user-1")).thenReturn(Optional.of(User.builder()
                .id("user-1")
                .fullName("Nguyen Van B")
                .email("b@fpt.edu.vn")
                .role("STUDENT")
                .build()));
        when(enrollmentRepository.save(any(CourseEnrollment.class))).thenAnswer(invocation -> invocation.getArgument(0));

        CourseEnrollment hydrated = service.hydrateFromUserAccount(enrollment);

        assertEquals("Nguyen Van B", hydrated.getStudentName());
        assertEquals("b@fpt.edu.vn", hydrated.getStudentEmail());
        verify(enrollmentRepository).save(enrollment);
    }

    @Test
    void listsClassStudentsHydratedFromAccounts() {
        CourseEnrollment enrollment = CourseEnrollment.builder()
                .studentId("user-2")
                .courseId("PRJ301")
                .classId("SE1832")
                .build();
        when(enrollmentRepository.findByCourseIdAndClassId("PRJ301", "SE1832"))
                .thenReturn(List.of(enrollment));
        when(userRepository.findById("user-2")).thenReturn(Optional.of(User.builder()
                .id("user-2")
                .fullName("Tran Thi C")
                .email("c@fpt.edu.vn")
                .role("STUDENT")
                .build()));
        when(enrollmentRepository.save(any(CourseEnrollment.class))).thenAnswer(invocation -> invocation.getArgument(0));

        List<CourseEnrollment> roster = service.listClassStudents("PRJ301", "SE1832");

        assertEquals(1, roster.size());
        assertEquals("Tran Thi C", roster.get(0).getStudentName());
        assertEquals("c@fpt.edu.vn", roster.get(0).getStudentEmail());
    }

    @Test
    void dropsAdminAccountsFromClassRoster() {
        CourseEnrollment adminEnroll = CourseEnrollment.builder()
                .id("e-admin")
                .studentId("admin-1")
                .courseId("PRJ301")
                .classId("SE1832")
                .build();
        CourseEnrollment studentEnroll = CourseEnrollment.builder()
                .id("e-student")
                .studentId("user-2")
                .studentName("Tran Thi C")
                .studentEmail("c@fpt.edu.vn")
                .courseId("PRJ301")
                .classId("SE1832")
                .build();
        when(enrollmentRepository.findByCourseIdAndClassId("PRJ301", "SE1832"))
                .thenReturn(List.of(adminEnroll, studentEnroll));
        when(userRepository.findById("admin-1")).thenReturn(Optional.of(User.builder()
                .id("admin-1")
                .fullName("System Admin")
                .email("admin@system.local")
                .role("ADMIN")
                .build()));
        when(userRepository.findById("user-2")).thenReturn(Optional.of(User.builder()
                .id("user-2")
                .fullName("Tran Thi C")
                .email("c@fpt.edu.vn")
                .role("STUDENT")
                .build()));

        List<CourseEnrollment> roster = service.listClassStudents("PRJ301", "SE1832");

        assertEquals(1, roster.size());
        assertEquals("Tran Thi C", roster.get(0).getStudentName());
        verify(enrollmentRepository).delete(adminEnroll);
    }

    @Test
    void dropsAccountEnrollmentsWhoseUserNoLongerExists() {
        CourseEnrollment orphan = CourseEnrollment.builder()
                .id("e-orphan")
                .studentId("c48453a6-d40d-428d-97d1-d65a627c941d")
                .studentName("học ngu")
                .studentEmail("se185018@gmail.com")
                .courseId("PRJ301")
                .classId("PRJ301-01")
                .build();
        when(enrollmentRepository.findByCourseIdAndClassId("PRJ301", "PRJ301-01"))
                .thenReturn(List.of(orphan));
        when(userRepository.findById("c48453a6-d40d-428d-97d1-d65a627c941d")).thenReturn(Optional.empty());
        when(userRepository.findByEmail("c48453a6-d40d-428d-97d1-d65a627c941d")).thenReturn(Optional.empty());
        when(userRepository.findByStudentCode("c48453a6-d40d-428d-97d1-d65a627c941d")).thenReturn(Optional.empty());
        when(userRepository.findByEmail("se185018@gmail.com")).thenReturn(Optional.empty());

        List<CourseEnrollment> roster = service.listClassStudents("PRJ301", "PRJ301-01");

        assertEquals(0, roster.size());
        verify(enrollmentRepository).delete(orphan);
    }

    @Test
    void resolvesStudentNameFromClassRosterInsteadOfRawId() {
        CourseEnrollment enrollment = CourseEnrollment.builder()
                .studentId("SE1840001")
                .studentCode("SE1840001")
                .studentName("Nguyen Van A")
                .studentEmail("anvse1840001@fpt.edu.vn")
                .courseId("PRJ301")
                .classId("SE1840")
                .build();
        when(enrollmentRepository.findByCourseIdAndClassId("PRJ301", "SE1840"))
                .thenReturn(List.of(enrollment));
        when(userRepository.findById("SE1840001")).thenReturn(Optional.empty());
        when(userRepository.findByEmail("SE1840001")).thenReturn(Optional.empty());
        when(userRepository.findByStudentCode("SE1840001")).thenReturn(Optional.empty());
        when(userRepository.findByEmail("anvse1840001@fpt.edu.vn")).thenReturn(Optional.empty());
        when(userRepository.findByStudentCode("SE1840001")).thenReturn(Optional.empty());

        CourseEnrollment resolved = service.resolveStudent(
                "SE1840001",
                "PRJ301",
                "SE1840",
                service.indexClassStudents("PRJ301", "SE1840"));

        assertEquals("Nguyen Van A", resolved.getStudentName());
        assertEquals("SE1840001", resolved.getStudentCode());
        assertEquals("anvse1840001@fpt.edu.vn", resolved.getStudentEmail());
    }

    @Test
    void fallsBackToUserAccountWhenStudentIsMissingFromRoster() {
        when(enrollmentRepository.findByCourseIdAndClassId("PRJ301", "SE1840")).thenReturn(List.of());
        when(enrollmentRepository.findByStudentIdAndCourseIdAndClassId(
                "user-9", "PRJ301", "SE1840")).thenReturn(Optional.empty());
        when(userRepository.findById("user-9")).thenReturn(Optional.of(User.builder()
                .id("user-9")
                .fullName("Le Thi D")
                .email("d@fpt.edu.vn")
                .role("STUDENT")
                .build()));

        CourseEnrollment resolved = service.resolveStudent("user-9", "PRJ301", "SE1840");

        assertEquals("Le Thi D", resolved.getStudentName());
        assertEquals("d@fpt.edu.vn", resolved.getStudentEmail());
    }

    @Test
    void overwritesStaleImportedNameFromTheRegisteredAccount() {
        CourseEnrollment enrollment = CourseEnrollment.builder()
                .id("e-1")
                .studentId("SE083418")
                .studentName("Suất Xắc")
                .studentEmail("se185018ngonhatminh@gmail.com")
                .courseId("PRO192")
                .classId("SE1832")
                .build();
        when(userRepository.findById("SE083418")).thenReturn(Optional.empty());
        when(userRepository.findByEmail("SE083418")).thenReturn(Optional.empty());
        when(userRepository.findByStudentCode("SE083418")).thenReturn(Optional.empty());
        when(userRepository.findByEmail("se185018ngonhatminh@gmail.com")).thenReturn(Optional.of(User.builder()
                .id("7bd7d121-b1b4-4b47-b077-a1d617a98219")
                .fullName("Nhật Minh")
                .email("se185018ngonhatminh@gmail.com")
                .studentCode("SE185018")
                .role("STUDENT")
                .build()));
        when(enrollmentRepository.findByStudentIdAndCourseIdAndClassId(
                "7bd7d121-b1b4-4b47-b077-a1d617a98219", "PRO192", "SE1832"))
                .thenReturn(Optional.empty());
        when(enrollmentRepository.save(any(CourseEnrollment.class))).thenAnswer(invocation -> invocation.getArgument(0));

        CourseEnrollment hydrated = service.hydrateFromUserAccount(enrollment);

        assertEquals("Nhật Minh", hydrated.getStudentName());
        assertEquals("se185018ngonhatminh@gmail.com", hydrated.getStudentEmail());
        assertEquals("7bd7d121-b1b4-4b47-b077-a1d617a98219", hydrated.getStudentId());
        assertEquals("SE185018", hydrated.getStudentCode());
        verify(enrollmentRepository).save(enrollment);
    }
}
