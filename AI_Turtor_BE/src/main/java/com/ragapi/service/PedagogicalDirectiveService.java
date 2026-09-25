package com.ragapi.service;

import com.ragapi.dto.PedagogicalDirectiveRequest;
import com.ragapi.entity.CourseEnrollment;
import com.ragapi.entity.PedagogicalDirective;
import com.ragapi.repository.PedagogicalDirectiveRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.*;

import static com.ragapi.util.ValidationUtils.requireText;

@Service
@RequiredArgsConstructor
public class PedagogicalDirectiveService {
    public static final String DEFAULT_SUPPORT_LEVEL = "STANDARD";
    private static final Set<String> SUPPORT_LEVELS =
            Set.of("HIGH_SUPPORT", "STANDARD", "CHALLENGE");

    private final PedagogicalDirectiveRepository repository;
    private final ClassRosterService classRosterService;

    public PedagogicalDirective createDraft(
            PedagogicalDirectiveRequest request,
            String teacherId,
            String teacherName
    ) {
        if (request == null) throw new IllegalArgumentException("request is required");
        LocalDateTime now = LocalDateTime.now();
        String instruction = requireText(request.getInstruction(), "instruction");
        String supportLevel = normalizeSupportLevel(request.getSupportLevel(), instruction);
        return repository.save(PedagogicalDirective.builder()
                .id(UUID.randomUUID().toString())
                .teacherId(requireText(teacherId, "teacherId"))
                .teacherName(trimToNull(teacherName))
                .studentId(trimToNull(request.getStudentId()))
                .courseId(requireText(request.getCourseId(), "courseId"))
                .classId(requireText(request.getClassId(), "classId"))
                .topic(trimToNull(request.getTopic()))
                .instruction(instruction)
                .scope(request.getStudentId() == null || request.getStudentId().isBlank() ? "CLASS" : "STUDENT")
                .status("DRAFT")
                .supportLevel(supportLevel)
                .priority(request.getPriority() == null ? 50 : Math.max(0, Math.min(100, request.getPriority())))
                .version(1)
                .effectiveFrom(now)
                .effectiveUntil(request.getEffectiveUntil())
                .createdAt(now)
                .updatedAt(now)
                .build());
    }

    public PedagogicalDirective confirm(String id, String teacherId) {
        PedagogicalDirective directive = requireOwned(id, teacherId);
        directive.setStatus("CONFIRMED");
        directive.setConfirmedAt(LocalDateTime.now());
        directive.setUpdatedAt(LocalDateTime.now());
        return repository.save(directive);
    }

    public PedagogicalDirective archive(String id, String teacherId) {
        PedagogicalDirective directive = requireOwned(id, teacherId);
        directive.setStatus("ARCHIVED");
        directive.setUpdatedAt(LocalDateTime.now());
        return repository.save(directive);
    }

    public List<PedagogicalDirective> listForClass(String courseId, String classId) {
        String safeCourseId = requireText(courseId, "courseId");
        String safeClassId = requireText(classId, "classId");
        List<PedagogicalDirective> directives = repository.findByCourseIdAndClassIdOrderByPriorityDescUpdatedAtDesc(
                safeCourseId, safeClassId);
        Map<String, CourseEnrollment> roster = classRosterService.indexClassStudents(safeCourseId, safeClassId);
        directives.forEach(directive -> {
            if (directive.getStudentId() == null || directive.getStudentId().isBlank()) {
                return;
            }
            CourseEnrollment identity = classRosterService.resolveStudent(
                    directive.getStudentId(), safeCourseId, safeClassId, roster);
            classRosterService.copyIdentity(identity, directive);
        });
        return directives;
    }

    public String buildTutorContext(String studentId, String courseId, String classId) {
        List<PedagogicalDirective> directives = activeDirectives(studentId, courseId, classId);
        if (directives.isEmpty()) return "";

        StringBuilder context = new StringBuilder()
                .append("- ACTIVE SUPPORT LEVEL: ")
                .append(resolveSupportLevel(directives))
                .append("\n")
                .append("- This level was explicitly selected by a teacher. Apply it immediately; ")
                .append("the student does not need to answer incorrectly first.");
        directives.stream()
                .limit(5)
                .forEach(directive -> context.append("\n- Teacher guidance: ")
                        .append(directive.getTopic() == null ? "" : directive.getTopic() + ": ")
                        .append(directive.getInstruction()));
        return context.toString();
    }

    /**
     * The support level is teacher-controlled. Learning memory and quiz mistakes must never
     * promote a student automatically; without an active confirmed directive the level is STANDARD.
     */
    public String resolveSupportLevel(String studentId, String courseId, String classId) {
        return resolveSupportLevel(activeDirectives(studentId, courseId, classId));
    }

    public boolean hasActiveDirective(String studentId, String courseId, String classId) {
        return !activeDirectives(studentId, courseId, classId).isEmpty();
    }

    private String resolveSupportLevel(List<PedagogicalDirective> directives) {
        return directives.stream()
                .map(PedagogicalDirective::getSupportLevel)
                .filter(Objects::nonNull)
                .map(level -> level.trim().toUpperCase(Locale.ROOT))
                .filter(SUPPORT_LEVELS::contains)
                .findFirst()
                .orElse(DEFAULT_SUPPORT_LEVEL);
    }

    private List<PedagogicalDirective> activeDirectives(String studentId, String courseId, String classId) {
        if (studentId == null || studentId.isBlank() || courseId == null || courseId.isBlank()) {
            return List.of();
        }
        String safeStudentId = studentId.trim();
        String safeCourseId = courseId.trim();
        String safeClassId = trimToNull(classId);
        LocalDateTime now = LocalDateTime.now();

        // Student-specific guidance always wins over class-wide guidance at the same course.
        List<PedagogicalDirective> studentDirectives = repository
                .findByStudentIdAndCourseIdAndStatusOrderByPriorityDescUpdatedAtDesc(
                        safeStudentId, safeCourseId, "CONFIRMED")
                .stream()
                .filter(directive -> safeClassId == null
                        || directive.getClassId() == null
                        || safeClassId.equals(directive.getClassId()))
                .filter(directive -> isEffective(directive, now))
                .sorted(directiveOrder())
                .toList();

        List<PedagogicalDirective> classDirectives = safeClassId == null
                ? List.of()
                : repository.findByCourseIdAndClassIdAndStatusOrderByPriorityDescUpdatedAtDesc(
                                safeCourseId, safeClassId, "CONFIRMED")
                        .stream()
                        // The repository query also returns student-scoped rows in the class.
                        // Never leak one student's teacher guidance into another student's prompt.
                        .filter(directive -> directive.getStudentId() == null
                                || directive.getStudentId().isBlank()
                                || "CLASS".equalsIgnoreCase(directive.getScope()))
                        .filter(directive -> isEffective(directive, now))
                        .sorted(directiveOrder())
                        .toList();

        List<PedagogicalDirective> result = new ArrayList<>(studentDirectives.size() + classDirectives.size());
        result.addAll(studentDirectives);
        result.addAll(classDirectives);
        return result;
    }

    private Comparator<PedagogicalDirective> directiveOrder() {
        return Comparator
                .comparing(PedagogicalDirective::getPriority,
                        Comparator.nullsLast(Comparator.reverseOrder()))
                .thenComparing(PedagogicalDirective::getUpdatedAt,
                        Comparator.nullsLast(Comparator.reverseOrder()));
    }

    private boolean isEffective(PedagogicalDirective directive, LocalDateTime now) {
        return (directive.getEffectiveFrom() == null || !directive.getEffectiveFrom().isAfter(now))
                && (directive.getEffectiveUntil() == null || directive.getEffectiveUntil().isAfter(now));
    }

    private PedagogicalDirective requireOwned(String id, String teacherId) {
        PedagogicalDirective directive = repository.findById(requireText(id, "id"))
                .orElseThrow(() -> new IllegalArgumentException("Pedagogical directive not found"));
        if (!requireText(teacherId, "teacherId").equals(directive.getTeacherId())) {
            throw new IllegalArgumentException("Only the directive author can change it");
        }
        return directive;
    }

    private String normalizeSupportLevel(String requested, String instruction) {
        if (requested != null && SUPPORT_LEVELS.contains(requested.trim().toUpperCase(Locale.ROOT))) {
            return requested.trim().toUpperCase(Locale.ROOT);
        }
        String normalized = instruction.toLowerCase(Locale.ROOT);
        if (containsAny(normalized, "từng bước", "chi tiết", "ví dụ đơn giản", "chậm", "step by step")) {
            return "HIGH_SUPPORT";
        }
        if (containsAny(normalized, "nâng cao", "thử thách", "ít gợi ý", "tự giải", "challenge")) {
            return "CHALLENGE";
        }
        return "STANDARD";
    }

    private boolean containsAny(String text, String... values) {
        return Arrays.stream(values).anyMatch(text::contains);
    }

    private String trimToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

}
