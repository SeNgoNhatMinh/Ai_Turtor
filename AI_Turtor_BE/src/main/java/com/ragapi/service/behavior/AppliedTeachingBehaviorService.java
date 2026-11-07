package com.ragapi.service.behavior;

import com.ragapi.dto.AssignTeachingBehaviorRequest;
import com.ragapi.dto.TeachingBehaviorTestRequest;
import com.ragapi.entity.AppliedTeachingBehavior;
import com.ragapi.entity.TeachingBehavior;
import com.ragapi.entity.TeachingBehaviorExecution;
import com.ragapi.entity.TeachingBehaviorVersion;
import com.ragapi.repository.AppliedTeachingBehaviorRepository;
import com.ragapi.repository.TeachingBehaviorExecutionRepository;
import com.ragapi.repository.TeachingBehaviorRepository;
import com.ragapi.repository.TeachingBehaviorVersionRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.NoSuchElementException;
import java.util.UUID;

import static com.ragapi.entity.AppliedTeachingBehavior.STATUS_ACTIVE;
import static com.ragapi.entity.AppliedTeachingBehavior.STATUS_INACTIVE;
import static com.ragapi.entity.TeachingBehavior.APPROVAL_APPROVED;
import static com.ragapi.entity.TeachingBehavior.SCOPE_GLOBAL;
import static com.ragapi.entity.TeachingBehavior.STATUS_APPROVED;
import static com.ragapi.entity.TeachingBehavior.STATUS_REJECTED;
import static com.ragapi.entity.TeachingBehavior.STATUS_RETIRED;
import static com.ragapi.service.behavior.BehaviorText.safe;
import static com.ragapi.service.behavior.BehaviorText.trimToNull;

/**
 * Assignments, versions, executions and the teacher overview for behavior templates.
 * Knowledge retrieval is not involved here.
 */
@Service
@RequiredArgsConstructor
public class AppliedTeachingBehaviorService {
    private final AppliedTeachingBehaviorRepository assignmentRepository;
    private final TeachingBehaviorExecutionRepository executionRepository;
    private final TeachingBehaviorVersionRepository versionRepository;
    private final TeachingBehaviorRepository behaviorRepository;
    private final TeachingBehaviorService behaviorService;
    private final MongoTemplate mongoTemplate;

    public Map<String, Object> overview(BehaviorActor actor) {
        Map<String, Object> library = behaviorService.list(null, null, null, null, null, 0, 1, actor);
        long total = number(library.get("totalElements"));
        long active = number(behaviorService.list(null, null, null, STATUS_APPROVED, null, 0, 1, actor).get("totalElements"));
        long pending = number(behaviorService.list(null, null, null, "AI_PENDING", null, 0, 1, actor).get("totalElements"));
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("totalBehaviors", total);
        result.put("activeBehaviors", active);
        result.put("pendingApproval", pending);
        List<String> courses = actor.isAdmin() ? List.of() : behaviorService.taughtCourseIds(actor);
        result.put("assignedBehaviors", countAssignments(courses, actor.isAdmin()));
        result.put("appliedExecutions", countExecutions(courses, actor.isAdmin(), TeachingBehaviorExecution.APPLIED));
        result.put("skippedExecutions", countExecutions(courses, actor.isAdmin(), TeachingBehaviorExecution.SKIPPED));
        result.put("failedExecutions", countExecutions(courses, actor.isAdmin(), TeachingBehaviorExecution.FAILED));
        return result;
    }

    public void recordRetrieval(String studentId, String courseId, String classId,
                                List<RetrievalSelection> selected, List<AppliedTeachingBehavior> assignments) {
        LocalDateTime now = LocalDateTime.now();
        java.util.Set<String> usedAssignments = new java.util.HashSet<>();
        for (RetrievalSelection selection : safeSelections(selected)) {
            if (selection.appliedBehaviorId() != null) usedAssignments.add(selection.appliedBehaviorId());
            executionRepository.save(execution(studentId, courseId, classId, selection.behaviorId(),
                    selection.behaviorVersion(), selection.appliedBehaviorId(), selection.strategy(),
                    selection.reason(), TeachingBehaviorExecution.APPLIED, now));
        }
        for (AppliedTeachingBehavior assignment : assignments == null ? List.<AppliedTeachingBehavior>of() : assignments) {
            if (assignment.getId() != null && usedAssignments.contains(assignment.getId())) continue;
            executionRepository.save(execution(studentId, courseId, classId, assignment.getBehaviorId(),
                    null, assignment.getId(), null, "Assigned but not selected for this question",
                    TeachingBehaviorExecution.SKIPPED, now));
        }
    }

    public void recordFailure(String studentId, String courseId, String classId, String reason) {
        executionRepository.save(execution(studentId, courseId, classId, null, null, null, null,
                reason, TeachingBehaviorExecution.FAILED, LocalDateTime.now()));
    }

    public record RetrievalSelection(String behaviorId, Integer behaviorVersion, String appliedBehaviorId,
                                     String strategy, String reason) {}

    public AppliedTeachingBehavior assign(String behaviorId, AssignTeachingBehaviorRequest request, BehaviorActor actor) {
        if (request == null || trimToNull(request.getCourseId()) == null) {
            throw new IllegalArgumentException("Thiếu môn học để gán hành vi");
        }
        TeachingBehavior behavior = behaviorService.get(behaviorId, actor);
        if (SCOPE_GLOBAL.equals(behavior.getScope()) && !actor.isAdmin()) {
            throw new BehaviorAccessDeniedException("Hành vi toàn hệ thống chỉ quản trị viên được gán");
        }
        if (!STATUS_APPROVED.equals(behavior.getStatus()) || isRejectedApproval(behavior)) {
            throw new IllegalArgumentException("Chỉ gán được hành vi đã duyệt và đang bật");
        }
        behaviorService.requireCourseTeacher(actor, request.getCourseId().trim(), trimToNull(request.getClassId()));
        String studentId = trimToNull(request.getStudentId());
        String courseId = request.getCourseId().trim();
        if (activeDuplicate(behaviorId, courseId, studentId) != null) {
            throw new IllegalArgumentException("Hành vi này đã được gán và đang bật cho đúng phạm vi");
        }
        LocalDateTime now = LocalDateTime.now();
        AppliedTeachingBehavior assignment = AppliedTeachingBehavior.builder()
                .id(UUID.randomUUID().toString())
                .behaviorId(behavior.getId())
                .courseId(courseId)
                .classId(trimToNull(request.getClassId()))
                .studentId(studentId)
                .customizedInstructions(trimToNull(request.getCustomizedInstructions()))
                .priorityOverride(request.getPriorityOverride())
                .status(STATUS_ACTIVE)
                .effectiveFrom(request.getEffectiveFrom())
                .effectiveUntil(request.getEffectiveUntil())
                .assignedBy(actor.id())
                .assignedByName(trimToNull(actor.name()))
                .createdAt(now)
                .updatedAt(now)
                .build();
        return assignmentRepository.save(assignment);
    }

    public List<AppliedTeachingBehavior> assignmentsOf(String behaviorId, BehaviorActor actor) {
        behaviorService.get(behaviorId, actor);
        return assignmentRepository.findByBehaviorId(behaviorId);
    }

    public Map<String, Object> listAssignments(String courseId, String studentId, String behaviorId, String status,
                                               BehaviorActor actor) {
        behaviorService.requireTeacher(actor);
        List<Criteria> filters = new ArrayList<>();
        if (trimToNull(courseId) != null) {
            behaviorService.requireCourseTeacher(actor, courseId.trim(), null);
            filters.add(Criteria.where("courseId").is(courseId.trim()));
        } else if (!actor.isAdmin()) {
            filters.add(Criteria.where("courseId").in(behaviorService.taughtCourseIds(actor)));
        }
        if (trimToNull(studentId) != null) filters.add(Criteria.where("studentId").is(studentId.trim()));
        if (trimToNull(behaviorId) != null) filters.add(Criteria.where("behaviorId").is(behaviorId.trim()));
        if (trimToNull(status) != null) filters.add(Criteria.where("status").is(status.trim().toUpperCase()));
        return page(filters, AppliedTeachingBehavior.class, "updatedAt");
    }

    public AppliedTeachingBehavior setAssignmentStatus(String assignmentId, String status, BehaviorActor actor) {
        AppliedTeachingBehavior assignment = assignmentRepository.findById(assignmentId)
                .orElseThrow(() -> new NoSuchElementException("Không tìm thấy lần gán"));
        behaviorService.requireCourseTeacher(actor, assignment.getCourseId(), assignment.getClassId());
        String next = trimToNull(status) == null ? "" : status.trim().toUpperCase();
        if (!List.of(STATUS_ACTIVE, STATUS_INACTIVE).contains(next)) {
            throw new IllegalArgumentException("Trạng thái gán không hợp lệ");
        }
        assignment.setStatus(next);
        assignment.setUpdatedAt(LocalDateTime.now());
        return assignmentRepository.save(assignment);
    }

    public List<TeachingBehaviorVersion> versions(String behaviorId, BehaviorActor actor) {
        behaviorService.get(behaviorId, actor);
        return versionRepository.findByBehaviorIdOrderByVersionDesc(behaviorId);
    }

    public TeachingBehavior rollback(String behaviorId, int version, BehaviorActor actor) {
        TeachingBehavior current = behaviorService.get(behaviorId, actor);
        if (!behaviorService.canEdit(current, actor)) {
            throw new BehaviorAccessDeniedException("Không có quyền khôi phục hành vi này");
        }
        TeachingBehaviorVersion snapshot = versionRepository.findByBehaviorIdAndVersion(behaviorId, version)
                .orElseThrow(() -> new NoSuchElementException("Không tìm thấy phiên bản " + version));
        behaviorService.snapshot(current, actor.id());
        current.setName(snapshot.getName());
        current.setDescription(snapshot.getDescription());
        current.setStrategy(snapshot.getStrategy());
        current.setInstruction(snapshot.getInstruction());
        current.setSupportLevels(new ArrayList<>(safe(snapshot.getSupportLevels())));
        current.setApplicableTopics(new ArrayList<>(safe(snapshot.getApplicableTopics())));
        current.setPriority(snapshot.getPriority());
        current.setVersion(Math.max(1, current.getVersion()) + 1);
        current.setUpdatedBy(actor.id());
        current.setUpdatedAt(LocalDateTime.now());
        return behaviorRepository.save(current);
    }

    public Map<String, Object> listExecutions(String behaviorId, String courseId, String studentId, String status,
                                              LocalDateTime from, LocalDateTime to, BehaviorActor actor) {
        if (trimToNull(behaviorId) != null) behaviorService.get(behaviorId, actor);
        else behaviorService.requireTeacher(actor);
        List<Criteria> filters = new ArrayList<>();
        if (trimToNull(behaviorId) != null) filters.add(Criteria.where("behaviorId").is(behaviorId.trim()));
        if (trimToNull(courseId) != null) {
            behaviorService.requireCourseTeacher(actor, courseId.trim(), null);
            filters.add(Criteria.where("courseId").is(courseId.trim()));
        } else if (!actor.isAdmin()) {
            filters.add(Criteria.where("courseId").in(behaviorService.taughtCourseIds(actor)));
        }
        if (trimToNull(studentId) != null) filters.add(Criteria.where("studentId").is(studentId.trim()));
        if (trimToNull(status) != null) filters.add(Criteria.where("executionStatus").is(status.trim().toUpperCase()));
        if (from != null || to != null) {
            Criteria when = Criteria.where("timestamp");
            if (from != null) when.gte(from);
            if (to != null) when.lte(to);
            filters.add(when);
        }
        return page(filters, TeachingBehaviorExecution.class, "timestamp");
    }

    /** Dry run: shows the instruction that would enter the prompt. Does not record an execution. */
    public Map<String, Object> testBehavior(String behaviorId, TeachingBehaviorTestRequest request, BehaviorActor actor) {
        TeachingBehavior behavior = behaviorService.get(behaviorId, actor);
        if (STATUS_RETIRED.equals(behavior.getStatus()) || STATUS_REJECTED.equals(behavior.getStatus())) {
            throw new IllegalArgumentException("Hành vi đã tắt hoặc bị từ chối, không thử được");
        }
        boolean approved = STATUS_APPROVED.equals(behavior.getStatus())
                && (behavior.getApprovalStatus() == null || APPROVAL_APPROVED.equals(behavior.getApprovalStatus()));
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("behaviorId", behavior.getId());
        result.put("name", behavior.getName());
        result.put("strategy", behavior.getStrategy());
        result.put("version", behavior.getVersion());
        result.put("instruction", behavior.getInstruction());
        result.put("approved", approved);
        result.put("wouldApply", approved);
        result.put("promptPreview", "1. " + behavior.getInstruction());
        result.put("note", approved
                ? "Hành vi đã duyệt. Câu trả lời sau của sinh viên được gán sẽ dùng đoạn này khi được chọn."
                : "Bản thử. Hành vi chưa duyệt nên chưa vào câu trả lời thật.");
        if (request != null && trimToNull(request.getQuestion()) != null) {
            result.put("question", request.getQuestion().trim());
        }
        return result;
    }

    public List<AppliedTeachingBehavior> activeFor(String studentId, String courseId, LocalDateTime now) {
        if (trimToNull(courseId) == null) return List.of();
        LocalDateTime moment = now == null ? LocalDateTime.now() : now;
        List<AppliedTeachingBehavior> rows = assignmentRepository.findByCourseIdAndStatus(courseId.trim(), STATUS_ACTIVE);
        List<AppliedTeachingBehavior> matched = new ArrayList<>();
        for (AppliedTeachingBehavior row : rows) {
            if (row.getStudentId() != null && !row.getStudentId().equals(studentId)) continue;
            if (row.getEffectiveFrom() != null && row.getEffectiveFrom().isAfter(moment)) continue;
            if (row.getEffectiveUntil() != null && row.getEffectiveUntil().isBefore(moment)) continue;
            matched.add(row);
        }
        return matched;
    }

    private AppliedTeachingBehavior activeDuplicate(String behaviorId, String courseId, String studentId) {
        for (AppliedTeachingBehavior row : assignmentRepository.findByBehaviorId(behaviorId)) {
            if (!STATUS_ACTIVE.equals(row.getStatus()) || !courseId.equals(row.getCourseId())) continue;
            boolean sameStudent = studentId == null ? row.getStudentId() == null : studentId.equals(row.getStudentId());
            if (sameStudent) return row;
        }
        return null;
    }

    private static boolean isRejectedApproval(TeachingBehavior behavior) {
        return TeachingBehavior.APPROVAL_REJECTED.equals(behavior.getApprovalStatus());
    }

    private Map<String, Object> page(List<Criteria> filters, Class<?> type, String sortField) {
        Query query = new Query();
        if (!filters.isEmpty()) query.addCriteria(new Criteria().andOperator(filters.toArray(new Criteria[0])));
        long total = mongoTemplate.count(query, type);
        query.with(Sort.by(Sort.Direction.DESC, sortField)).limit(100);
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("items", mongoTemplate.find(query, type));
        result.put("totalElements", total);
        return result;
    }

    private long countAssignments(List<String> courses, boolean admin) {
        if (admin) return assignmentRepository.countByStatus(STATUS_ACTIVE);
        if (courses.isEmpty()) return 0;
        Query query = Query.query(Criteria.where("status").is(STATUS_ACTIVE).and("courseId").in(courses));
        return mongoTemplate.count(query, AppliedTeachingBehavior.class);
    }

    private long countExecutions(List<String> courses, boolean admin, String status) {
        if (admin) return executionRepository.countByExecutionStatus(status);
        if (courses.isEmpty()) return 0;
        Query query = Query.query(Criteria.where("executionStatus").is(status).and("courseId").in(courses));
        return mongoTemplate.count(query, TeachingBehaviorExecution.class);
    }

    private static List<RetrievalSelection> safeSelections(List<RetrievalSelection> selected) {
        return selected == null ? List.of() : selected;
    }

    private static TeachingBehaviorExecution execution(String studentId, String courseId, String classId,
                                                       String behaviorId, Integer version, String appliedId,
                                                       String strategy, String reason, String status,
                                                       LocalDateTime now) {
        return TeachingBehaviorExecution.builder()
                .id(UUID.randomUUID().toString())
                .studentId(studentId)
                .courseId(courseId)
                .classId(classId)
                .behaviorId(behaviorId)
                .behaviorVersion(version)
                .appliedBehaviorId(appliedId)
                .selectedStrategy(strategy)
                .selectionReason(reason)
                .executionStatus(status)
                .timestamp(now)
                .build();
    }

    private static long number(Object value) {
        return value instanceof Number number ? number.longValue() : 0L;
    }
}
