package com.ragapi.service;

import com.ragapi.entity.Assignment;
import com.ragapi.entity.AssignmentSubmission;
import com.ragapi.entity.ClassSection;
import com.ragapi.entity.CourseEnrollment;
import com.ragapi.entity.CourseMaterial;
import com.ragapi.entity.ImprovePlan;
import com.ragapi.entity.KnowledgeCandidate;
import com.ragapi.entity.QuestionEscalation;
import com.ragapi.entity.StudentCourseMemory;
import com.ragapi.entity.Mentor;
import com.ragapi.repository.AssignmentRepository;
import com.ragapi.repository.AssignmentSubmissionRepository;
import com.ragapi.repository.ClassSectionRepository;
import com.ragapi.repository.CourseEnrollmentRepository;
import com.ragapi.repository.CourseMaterialRepository;
import com.ragapi.repository.ImprovePlanRepository;
import com.ragapi.repository.KnowledgeCandidateRepository;
import com.ragapi.repository.MentorRepository;
import com.ragapi.repository.QuestionEscalationRepository;
import com.ragapi.repository.StudentCourseMemoryRepository;
import lombok.AllArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@AllArgsConstructor
public class LearningDashboardService {

    private final CourseEnrollmentRepository enrollmentRepository;
    private final ClassSectionRepository classSectionRepository;
    private final AssignmentRepository assignmentRepository;
    private final AssignmentSubmissionRepository submissionRepository;
    private final CourseMaterialRepository materialRepository;
    private final StudentCourseMemoryRepository memoryRepository;
    private final QuestionEscalationRepository escalationRepository;
    private final KnowledgeCandidateRepository candidateRepository;
    private final ImprovePlanRepository improvePlanRepository;
    private final MentorRepository mentorRepository;

    public Map<String, Object> buildStudentDashboard(String studentId, String courseId) {
        List<CourseEnrollment> enrollments = enrollmentRepository.findByStudentId(studentId).stream()
                .filter(item -> isBlank(courseId) || courseId.equals(item.getCourseId()))
                .toList();
        List<String> courseIds = enrollments.stream().map(CourseEnrollment::getCourseId).distinct().toList();

        List<Assignment> assignments = assignmentRepository.findAll().stream()
                .filter(item -> courseIds.contains(item.getCourseId()))
                .filter(item -> isStudentTargeted(item, studentId, enrollments))
                .toList();
        List<AssignmentSubmission> submissions = submissionRepository.findByStudentId(studentId).stream()
                .filter(item -> isBlank(courseId) || courseId.equals(item.getCourseId()))
                .toList();
        List<StudentCourseMemory> memories = courseIds.stream()
                .map(cid -> memoryRepository.findByStudentIdAndCourseId(studentId, cid).orElse(null))
                .filter(item -> item != null)
                .toList();
        List<ImprovePlan> plans = improvePlanRepository.findByStudentId(studentId).stream()
                .filter(item -> isBlank(courseId) || courseId.equals(item.getCourseId()))
                .toList();
        List<QuestionEscalation> escalations = escalationRepository.findByUserId(studentId).stream()
                .filter(item -> isBlank(courseId) || courseId.equals(item.getCourseId()))
                .toList();

        Map<String, Object> dashboard = new LinkedHashMap<>();
        dashboard.put("studentId", studentId);
        dashboard.put("enrollments", enrollments);
        dashboard.put("assignments", assignments);
        dashboard.put("submissions", submissions);
        dashboard.put("memories", memories);
        dashboard.put("improvePlans", plans);
        dashboard.put("escalations", escalations);
        dashboard.put("weakTopics", memories.stream()
                .filter(item -> item.getWeakTopics() != null)
                .flatMap(item -> item.getWeakTopics().stream())
                .distinct()
                .toList());
        return dashboard;
    }

    public Map<String, Object> buildTeacherDashboard(String teacherId, String courseId, String classId) {
        List<ClassSection> classes = classSectionRepository.findAll().stream()
                .filter(item -> matchesTeacherId(teacherId, item.getTeacherId()))
                .filter(item -> isBlank(courseId) || courseId.equals(item.getCourseId()))
                .filter(item -> isBlank(classId) || classId.equals(item.getClassId()))
                .toList();
        List<CourseEnrollment> students = classes.stream()
                .flatMap(section -> enrollmentRepository.findByCourseIdAndClassId(section.getCourseId(), section.getClassId()).stream())
                .toList();
        List<Assignment> assignments = assignmentRepository.findAll().stream()
                .filter(item -> matchesTeacherId(teacherId, item.getTeacherId()))
                .filter(item -> isBlank(courseId) || courseId.equals(item.getCourseId()))
                .filter(item -> isBlank(classId) || classId.equals(item.getClassId()))
                .toList();
        List<AssignmentSubmission> submissions = submissionRepository.findAll().stream()
                .filter(item -> matchesTeacherId(teacherId, item.getTeacherId()))
                .filter(item -> isBlank(courseId) || courseId.equals(item.getCourseId()))
                .filter(item -> isBlank(classId) || classId.equals(item.getClassId()))
                .toList();
        List<CourseMaterial> materials = materialRepository.findAll().stream()
                .filter(item -> matchesTeacherId(teacherId, item.getTeacherId()))
                .filter(item -> isBlank(courseId) || courseId.equals(item.getCourseId()))
                .toList();
        List<QuestionEscalation> escalations = escalationRepository.findAll().stream()
                .filter(item -> isAssignedToTeacher(item, teacherId))
                .filter(item -> isBlank(courseId) || courseId.equals(item.getCourseId()))
                .filter(item -> isBlank(classId) || classId.equals(item.getClassId()))
                .toList();
        List<KnowledgeCandidate> candidates = candidateRepository.findAll().stream()
                .filter(item -> matchesTeacherId(teacherId, item.getTeacherId()))
                .filter(item -> isBlank(courseId) || courseId.equals(item.getCourseId()))
                .filter(item -> "PENDING_SENIOR_REVIEW".equalsIgnoreCase(item.getStatus()) || "PENDING_REVIEW".equalsIgnoreCase(item.getStatus()))
                .toList();

        Map<String, Long> weakTopicCounts = students.stream()
                .map(enrollment -> memoryRepository.findByStudentIdAndCourseId(enrollment.getStudentId(), enrollment.getCourseId()).orElse(null))
                .filter(item -> item != null && item.getWeakTopics() != null)
                .flatMap(item -> item.getWeakTopics().stream())
                .collect(Collectors.groupingBy(topic -> topic, LinkedHashMap::new, Collectors.counting()));

        Map<String, Object> dashboard = new LinkedHashMap<>();
        dashboard.put("teacherId", teacherId);
        dashboard.put("classes", classes);
        dashboard.put("students", students);
        dashboard.put("assignments", assignments);
        dashboard.put("submissions", submissions);
        dashboard.put("materials", materials);
        dashboard.put("escalations", escalations);
        dashboard.put("pendingKnowledgeCandidates", candidates);
        dashboard.put("weakTopicCounts", weakTopicCounts);
        dashboard.put("analytics", Map.of(
                "classCount", classes.size(),
                "studentCount", students.size(),
                "assignmentCount", assignments.size(),
                "submissionCount", submissions.size(),
                "pendingEscalationCount", escalations.stream().filter(item -> !"COMPLETED".equalsIgnoreCase(item.getStatus())).count(),
                "pendingKnowledgeCandidateCount", candidates.size()
        ));
        return dashboard;
    }

    public List<QuestionEscalation> listTeacherEscalationInbox(String teacherId, String status, String query) {
        return escalationRepository.findAll().stream()
                .filter(item -> isAssignedToTeacher(item, teacherId))
                .filter(item -> isBlank(status) || status.equalsIgnoreCase(item.getStatus()))
                .filter(item -> matchesEscalationQuery(item, query))
                .toList();
    }

    private boolean matchesEscalationQuery(QuestionEscalation item, String query) {
        if (isBlank(query)) return true;
        String q = query.trim().toLowerCase();
        return List.of(item.getOriginalQuestion(), item.getUserName(), item.getUserEmail(), item.getUserId(),
                        item.getCourseId(), item.getClassId(), item.getStatus())
                .stream().filter(value -> value != null)
                .anyMatch(value -> value.toLowerCase().contains(q));
    }

    private boolean isStudentTargeted(Assignment assignment, String studentId, List<CourseEnrollment> enrollments) {
        if ("SELECTED_STUDENTS".equalsIgnoreCase(assignment.getTargetType())) {
            return assignment.getTargetStudentIds() != null && assignment.getTargetStudentIds().contains(studentId);
        }
        return enrollments.stream().anyMatch(enrollment -> assignment.getCourseId().equals(enrollment.getCourseId())
                && assignment.getClassId().equals(enrollment.getClassId()));
    }

    private boolean isAssignedToTeacher(QuestionEscalation escalation, String teacherId) {
        return escalation != null
                && !isBlank(escalation.getAssignedMentorId())
                && matchesTeacherId(teacherId, escalation.getAssignedMentorId());
    }

    private boolean matchesTeacherId(String requesterTeacherId, String sectionTeacherKey) {
        if (isBlank(requesterTeacherId) || isBlank(sectionTeacherKey)) return false;
        if (requesterTeacherId.equals(sectionTeacherKey)) return true;

        var requesterMentor = mentorRepository.findById(requesterTeacherId)
                .or(() -> mentorRepository.findByMentorCode(requesterTeacherId));
        var sectionMentor = mentorRepository.findById(sectionTeacherKey)
                .or(() -> mentorRepository.findByMentorCode(sectionTeacherKey));

        if (requesterMentor.isPresent() && sectionMentor.isPresent()) {
            return requesterMentor.get().getId().equals(sectionMentor.get().getId());
        }
        if (requesterMentor.isPresent()) {
            return requesterMentor.get().getId().equals(sectionTeacherKey)
                    || requesterMentor.get().getMentorCode().equalsIgnoreCase(sectionTeacherKey);
        }
        if (sectionMentor.isPresent()) {
            return sectionMentor.get().getId().equals(requesterTeacherId)
                    || sectionMentor.get().getMentorCode().equalsIgnoreCase(requesterTeacherId);
        }
        return false;
    }

    private boolean isBlank(String value) {
        return value == null || value.isBlank();
    }
}
