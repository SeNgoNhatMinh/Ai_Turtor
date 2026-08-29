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
}
