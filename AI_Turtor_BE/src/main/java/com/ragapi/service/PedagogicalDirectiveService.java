package com.ragapi.service;

import com.ragapi.dto.PedagogicalDirectiveRequest;
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
    private static final Set<String> SUPPORT_LEVELS =
            Set.of("HIGH_SUPPORT", "STANDARD", "CHALLENGE");

    private final PedagogicalDirectiveRepository repository;

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
        return repository.findByCourseIdAndClassIdOrderByPriorityDescUpdatedAtDesc(
                requireText(courseId, "courseId"), requireText(classId, "classId"));
    }

    public String buildTutorContext(String studentId, String courseId, String classId) {
        if (studentId == null || studentId.isBlank() || courseId == null || courseId.isBlank()) return "";
        List<PedagogicalDirective> directives = new ArrayList<>(
                repository.findByStudentIdAndCourseIdAndStatusOrderByPriorityDescUpdatedAtDesc(
                        studentId, courseId, "CONFIRMED"));
        if (classId != null && !classId.isBlank()) {
            directives.addAll(repository.findByCourseIdAndClassIdAndStatusOrderByPriorityDescUpdatedAtDesc(
                    courseId, classId, "CONFIRMED"));
        }
        LocalDateTime now = LocalDateTime.now();
        return directives.stream()
                .filter(directive -> directive.getEffectiveFrom() == null || !directive.getEffectiveFrom().isAfter(now))
                .filter(directive -> directive.getEffectiveUntil() == null || directive.getEffectiveUntil().isAfter(now))
                .sorted(Comparator.comparing(
                        PedagogicalDirective::getPriority,
                        Comparator.nullsLast(Comparator.reverseOrder())))
                .limit(5)
                .map(directive -> "- [" + nullSafe(directive.getSupportLevel()) + "] "
                        + (directive.getTopic() == null ? "" : directive.getTopic() + ": ")
                        + directive.getInstruction())
                .reduce((left, right) -> left + "\n" + right)
                .orElse("");
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

    private String nullSafe(String value) {
        return value == null ? "STANDARD" : value;
    }
}
