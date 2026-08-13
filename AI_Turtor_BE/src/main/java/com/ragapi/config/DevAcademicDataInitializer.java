package com.ragapi.config;

import com.ragapi.entity.ClassSection;
import com.ragapi.entity.Course;
import com.ragapi.entity.CourseEnrollment;
import com.ragapi.entity.Mentor;
import com.ragapi.repository.ClassSectionRepository;
import com.ragapi.repository.CourseEnrollmentRepository;
import com.ragapi.repository.CourseRepository;
import com.ragapi.repository.MentorRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Slf4j
@Component
@RequiredArgsConstructor
public class DevAcademicDataInitializer implements CommandLineRunner {

    private final CourseRepository courseRepository;
    private final ClassSectionRepository classSectionRepository;
    private final CourseEnrollmentRepository enrollmentRepository;
    private final MentorRepository mentorRepository;

    @Value("${app.dev-seed.enabled:true}")
    private boolean enabled;

    @Override
    public void run(String... args) {
        if (!enabled) {
            return;
        }

        seedCourse("PRJ301", "Java Web Application Development", "SEM5");
        seedMentor();
        seedClassSection();
        seedEnrollment();
        log.info("Dev academic seed checked for PRJ301/SE1840");
    }

    private void seedCourse(String courseId, String courseName, String semesterId) {
        courseRepository.findByCourseId(courseId).orElseGet(() -> courseRepository.save(Course.builder()
                .id(UUID.randomUUID().toString())
                .courseId(courseId)
                .courseName(courseName)
                .semesterId(semesterId)
                .description("Default dev course for frontend integration testing")
                .credits(3)
                .status("ACTIVE")
                .createdAt(LocalDateTime.now())
                .updatedAt(LocalDateTime.now())
                .build()));
    }

    private void seedMentor() {
        boolean exists = mentorRepository.findAll().stream()
                .anyMatch(mentor -> "TEACHER_A".equalsIgnoreCase(mentor.getMentorCode()));
        if (exists) {
            return;
        }
        mentorRepository.save(Mentor.builder()
                .id(UUID.randomUUID().toString())
                .mentorCode("TEACHER_A")
                .mentorName("Teacher A")
                .email("teacher.a@school.local")
                .phone("0900000000")
                .department("Software Engineering")
                .faculty("Information Technology")
                .managedCourseIds(List.of("PRJ301", "PRO192"))
                .teachingClassIds(List.of("SE1840"))
                .specializations(List.of("Java", "Spring Boot", "Web Application"))
                .categories(List.of("AI_TUTOR", "COURSE_MENTOR"))
                .keywords(List.of("PRJ301", "PRO192", "Java", "Spring"))
                .isActive(true)
                .verified(true)
                .createdAt(LocalDateTime.now())
                .updatedAt(LocalDateTime.now())
                .build());
    }

    private void seedClassSection() {
        classSectionRepository.findByCourseIdAndClassId("PRJ301", "SE1840").orElseGet(() -> classSectionRepository.save(ClassSection.builder()
                .id(UUID.randomUUID().toString())
                .semesterId("SEM5")
                .courseId("PRJ301")
                .courseName("Java Web Application Development")
                .classId("SE1840")
                .className("SE1840")
                .teacherId("TEACHER_A")
                .teacherName("Teacher A")
                .teacherEmail("teacher.a@school.local")
                .status("ACTIVE")
                .startedAt(LocalDateTime.now().minusWeeks(1))
                .createdAt(LocalDateTime.now())
                .updatedAt(LocalDateTime.now())
                .build()));
    }

    private void seedEnrollment() {
        enrollmentRepository.findByStudentIdAndCourseIdAndClassId("SE1840001", "PRJ301", "SE1840")
                .orElseGet(() -> enrollmentRepository.save(CourseEnrollment.builder()
                        .id(UUID.randomUUID().toString())
                        .studentId("SE1840001")
                        .studentCode("SE1840001")
                        .studentName("Nguyen Van A")
                        .semesterId("SEM5")
                        .courseId("PRJ301")
                        .courseName("Java Web Application Development")
                        .classId("SE1840")
                        .className("SE1840")
                        .status("ACTIVE")
                        .enrolledAt(LocalDateTime.now())
                        .createdAt(LocalDateTime.now())
                        .updatedAt(LocalDateTime.now())
                        .build()));
    }
}