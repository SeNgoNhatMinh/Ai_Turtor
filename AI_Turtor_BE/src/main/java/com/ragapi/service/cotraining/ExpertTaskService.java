package com.ragapi.service.cotraining;

import com.ragapi.dto.cotraining.*;
import com.ragapi.entity.CourseChapterOutline;
import com.ragapi.entity.ExpertTask;
import com.ragapi.repository.CoverageGapRepository;
import com.ragapi.repository.ExpertRubricRepository;
import com.ragapi.repository.ExpertTaskRepository;
import com.ragapi.repository.GoldQaRepository;
import com.ragapi.service.ChapterOutlineService;
import com.ragapi.service.RealtimeEventService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.*;
import java.util.regex.Pattern;

import static com.ragapi.util.ValidationUtils.*;

@Service
@RequiredArgsConstructor
public class ExpertTaskService {
    private static final Set<String> TASK_TYPES = Set.of("GOLD_QA", "RUBRIC", "RANKING", "REVIEW");
    private static final Set<String> TASK_STATUSES = Set.of(
            "OPEN", "ASSIGNED", "IN_PROGRESS", "SUBMITTED", "COMPLETED", "CANCELLED");

    private final ExpertTaskRepository taskRepository;
    private final GoldQaRepository goldQaRepository;
    private final ExpertRubricRepository rubricRepository;
    private final CoverageGapRepository gapRepository;
    private final ChapterOutlineService chapterOutlineService;
    private final RealtimeEventService realtimeEvents;
    private final MongoTemplate mongoTemplate;

    public ExpertTask createTask(CreateExpertTaskRequest request) {
        if (request == null) throw new IllegalArgumentException("request is required");
        String type = enumValue(request.getType(), "type", TASK_TYPES);
        LocalDateTime now = LocalDateTime.now();
        LocalDateTime dueAt = normalizeDueAt(request.getDueAt());
        ExpertTask saved = taskRepository.save(ExpertTask.builder()
                .courseId(requireText(request.getCourseId(), "courseId"))
                .chapter(requireMaxLength(request.getChapter(), "chapter", SHORT_TEXT_MAX_LENGTH))
                .type(type).status("OPEN")
                .priority(clampPriority(request.getPriority()))
                .sourceGapId(optionalMaxLength(request.getSourceGapId(), "sourceGapId", SHORT_TEXT_MAX_LENGTH))
                .title(requireMaxLength(request.getTitle(), "title", SHORT_TEXT_MAX_LENGTH))
                .instructions(optionalMaxLength(request.getInstructions(), "instructions", DEFAULT_TEXT_MAX_LENGTH))
                .createdBy(optionalMaxLength(request.getCreatedBy(), "createdBy", SHORT_TEXT_MAX_LENGTH))
                .dueAt(dueAt).createdAt(now).updatedAt(now).build());
        realtimeEvents.publishToRoles(Set.of("TEACHER", "SENIOR_MENTOR", "ADMIN"),
                "EXPERT_TASK_CREATED", "EXPERT_TASK", saved.getId(), saved.getStatus(),
                Map.of("courseId", saved.getCourseId(), "chapter", saved.getChapter(), "type", saved.getType()));
        return saved;
    }

    public List<ExpertTask> startChapter(CreateChapterTasksRequest request) {
        if (request == null) {
            throw new IllegalArgumentException("request is required");
        }
        String courseId = requireText(request.getCourseId(), "courseId");
        String chapter = requireText(request.getChapter(), "chapter");
        CourseChapterOutline outline = chapterOutlineService.findOutlineByTitle(courseId, chapter);
        if (outline == null) {
            throw new IllegalArgumentException("Chapter does not exist in indexed course materials");
        }
        if (outline.getChunkCount() == null || outline.getChunkCount() <= 0) {
            throw new IllegalArgumentException("Chapter has no indexed content");
        }
        chapter = outline.getTitle();
        List<ExpertTask> active = taskRepository.findByCourseIdAndChapterOrderByCreatedAtDesc(courseId, chapter).stream()
                .filter(task -> "GOLD_QA".equals(task.getType()))
                .filter(task -> Set.of("OPEN", "ASSIGNED", "IN_PROGRESS", "SUBMITTED").contains(task.getStatus()))
                .toList();
        if (!active.isEmpty()) {
            return active;
        }
        int count = request.getQuestionCount() == null ? 2 : Math.max(1, Math.min(5, request.getQuestionCount()));
        LocalDateTime dueAt = normalizeDueAt(request.getDueAt());
        String createdBy = optionalMaxLength(request.getCreatedBy(), "createdBy", SHORT_TEXT_MAX_LENGTH);
        List<ExpertTask> created = new ArrayList<>();
        for (int index = 1; index <= count; index++) {
            CreateExpertTaskRequest task = new CreateExpertTaskRequest();
            task.setCourseId(courseId);
            task.setChapter(chapter);
            task.setType("GOLD_QA");
            task.setPriority(80);
            task.setTitle("Q&A vàng " + index + "/" + count + " — " + chapter);
            task.setInstructions("Giáo trình là chuẩn duy nhất. "
                    + "Soạn câu hỏi + tóm tắt ý từ sách, rồi Lưu/Thi lại để xem trước câu AI sẽ trả cho SV (sách + tóm tắt, chưa nạp RAG). "
                    + "Khi câu đủ ý mới Gửi Senior — Senior chỉ duyệt nạp TRAINING, không phải bước làm AI tốt hơn.");
            task.setCreatedBy(createdBy);
            task.setDueAt(dueAt);
            created.add(createTask(task));
        }
        return created;
    }

    public List<ExpertTask> createChapterTasks(CreateChapterTasksRequest request) {
        return startChapter(request);
    }

    public List<ExpertTask> listTasks(String status, String courseId, String assigneeId) {
        if (assigneeId != null && !assigneeId.isBlank()) return taskRepository.findByAssigneeIdOrderByCreatedAtDesc(assigneeId.trim());
        if (courseId != null && !courseId.isBlank()) return taskRepository.findByCourseIdOrderByCreatedAtDesc(courseId.trim()).stream()
                .filter(t -> status == null || status.isBlank() || status.equalsIgnoreCase(t.getStatus())).toList();
        if (status != null && !status.isBlank()) return taskRepository.findByStatusOrderByPriorityDescCreatedAtAsc(status.trim().toUpperCase(Locale.ROOT));
        return taskRepository.findAll();
    }

    public Map<String, Object> searchTasks(
            String status,
            String courseId,
            String assigneeId,
            String type,
            String keyword,
            int page,
            int size,
            String sortBy,
            String sortDirection
    ) {
        int safePage = Math.max(0, page);
        int safeSize = Math.max(1, Math.min(100, size));
        Query mongoQuery = new Query();
        if (courseId != null && !courseId.isBlank()) {
            mongoQuery.addCriteria(Criteria.where("courseId").is(courseId.trim()));
        }
        if (status != null && !status.isBlank()) {
            mongoQuery.addCriteria(Criteria.where("status").is(enumValue(status, "status", TASK_STATUSES)));
        }
        if (type != null && !type.isBlank()) {
            mongoQuery.addCriteria(Criteria.where("type").is(enumValue(type, "type", TASK_TYPES)));
        }
        if (assigneeId != null && !assigneeId.isBlank()) {
            mongoQuery.addCriteria(Criteria.where("assigneeId").is(assigneeId.trim()));
        }
        if (keyword != null && !keyword.isBlank()) {
            Pattern searchPattern = Pattern.compile(Pattern.quote(keyword.trim()), Pattern.CASE_INSENSITIVE | Pattern.UNICODE_CASE);
            mongoQuery.addCriteria(new Criteria().orOperator(
                    Criteria.where("title").regex(searchPattern),
                    Criteria.where("chapter").regex(searchPattern),
                    Criteria.where("instructions").regex(searchPattern),
                    Criteria.where("assigneeId").regex(searchPattern),
                    Criteria.where("createdBy").regex(searchPattern)
            ));
        }

        long totalElements = mongoTemplate.count(mongoQuery, ExpertTask.class);
        String requestedSortBy = defaultText(sortBy, "updatedAt");
        String safeSortBy = switch (requestedSortBy) {
            case "createdAt", "dueAt", "priority", "status", "title" -> requestedSortBy;
            default -> "updatedAt";
        };
        Sort.Direction direction = "asc".equalsIgnoreCase(sortDirection)
                ? Sort.Direction.ASC
                : Sort.Direction.DESC;
        mongoQuery.with(Sort.by(direction, safeSortBy).and(Sort.by(Sort.Direction.DESC, "createdAt")));
        mongoQuery.skip((long) safePage * safeSize).limit(safeSize);
        List<ExpertTask> tasks = mongoTemplate.find(mongoQuery, ExpertTask.class);
        int totalPages = totalElements == 0 ? 0 : (int) Math.ceil(totalElements / (double) safeSize);

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("tasks", tasks);
        response.put("page", safePage);
        response.put("size", safeSize);
        response.put("totalElements", totalElements);
        response.put("totalPages", totalPages);
        response.put("hasNext", safePage + 1 < totalPages);
        return response;
    }

    public ExpertTask getTask(String id) {
        return task(id);
    }

    public ExpertTask updateTask(String id, UpdateExpertTaskRequest request) {
        if (request == null) throw new IllegalArgumentException("request is required");
        ExpertTask task = task(id);
        if (request.getTitle() != null) {
            task.setTitle(requireMaxLength(request.getTitle(), "title", SHORT_TEXT_MAX_LENGTH));
        }
        if (request.getInstructions() != null) {
            task.setInstructions(optionalMaxLength(request.getInstructions(), "instructions", DEFAULT_TEXT_MAX_LENGTH));
        }
        if (request.getPriority() != null) {
            task.setPriority(clampPriority(request.getPriority()));
        }
        task.setDueAt(request.getDueAt() == null ? null : normalizeDueAt(request.getDueAt()));

        String nextStatus = request.getStatus() == null || request.getStatus().isBlank()
                ? task.getStatus()
                : enumValue(request.getStatus(), "status", TASK_STATUSES);
        boolean statusChanged = !Objects.equals(nextStatus, task.getStatus());
        boolean hasContribution = !goldQaRepository.findBySourceTaskId(task.getId()).isEmpty()
                || !rubricRepository.findBySourceTaskId(task.getId()).isEmpty();
        if (hasContribution && statusChanged) {
            throw new IllegalArgumentException("Task already has a contribution; its status is controlled by the review flow");
        }

        if (request.getAssigneeId() != null) {
            String assigneeId = request.getAssigneeId().trim();
            task.setAssigneeId(assigneeId.isBlank() ? null : assigneeId);
            task.setAssigneeTier(task.getAssigneeId() == null
                    ? null
                    : optionalMaxLength(request.getAssigneeTier(), "assigneeTier", SHORT_TEXT_MAX_LENGTH));
        }
        if ("OPEN".equals(nextStatus)) {
            task.setAssigneeId(null);
            task.setAssigneeTier(null);
        } else if (Set.of("ASSIGNED", "IN_PROGRESS").contains(nextStatus)
                && (task.getAssigneeId() == null || task.getAssigneeId().isBlank())) {
            throw new IllegalArgumentException("assigneeId is required for status " + nextStatus);
        }

        task.setStatus(nextStatus);
        task.setCompletedAt(Set.of("COMPLETED", "CANCELLED").contains(nextStatus)
                ? Optional.ofNullable(task.getCompletedAt()).orElse(LocalDateTime.now())
                : null);
        task.setUpdatedAt(LocalDateTime.now());
        ExpertTask saved = taskRepository.save(task);
        realtimeEvents.publishToRoles(Set.of("TEACHER", "SENIOR_MENTOR", "ADMIN"),
                "EXPERT_TASK_UPDATED", "EXPERT_TASK", saved.getId(), saved.getStatus(),
                Map.of("courseId", saved.getCourseId(), "chapter", saved.getChapter(), "type", saved.getType()));
        return saved;
    }

    public void deleteTask(String id) {
        ExpertTask task = task(id);
        if (!goldQaRepository.findBySourceTaskId(task.getId()).isEmpty()
                || !rubricRepository.findBySourceTaskId(task.getId()).isEmpty()) {
            throw new IllegalArgumentException(
                    "Task already has a contribution and cannot be deleted; cancel it or complete the review flow");
        }
        taskRepository.delete(task);
        if (task.getSourceGapId() != null && !task.getSourceGapId().isBlank()) {
            gapRepository.findById(task.getSourceGapId()).ifPresent(gap -> {
                gap.setStatus("OPEN");
                gap.setUpdatedAt(LocalDateTime.now());
                gapRepository.save(gap);
            });
        }
        realtimeEvents.publishToRoles(Set.of("TEACHER", "SENIOR_MENTOR", "ADMIN"),
                "EXPERT_TASK_DELETED", "EXPERT_TASK", task.getId(), "DELETED",
                Map.of("courseId", task.getCourseId(), "chapter", task.getChapter(), "type", task.getType()));
    }

    public ExpertTask assignTask(String id, AssignExpertTaskRequest request) {
        ExpertTask task = task(id);
        if (!Set.of("OPEN", "ASSIGNED").contains(task.getStatus())) throw new IllegalArgumentException("Task cannot be assigned in status " + task.getStatus());
        task.setAssigneeId(requireText(request == null ? null : request.getAssigneeId(), "assigneeId"));
        task.setAssigneeTier(optionalMaxLength(request.getAssigneeTier(), "assigneeTier", SHORT_TEXT_MAX_LENGTH));
        task.setStatus("ASSIGNED"); task.setUpdatedAt(LocalDateTime.now());
        ExpertTask saved = taskRepository.save(task);
        realtimeEvents.publishToUser(saved.getAssigneeId(), "EXPERT_TASK_ASSIGNED", "EXPERT_TASK",
                saved.getId(), saved.getStatus(), Map.of("courseId", saved.getCourseId(), "chapter", saved.getChapter()));
        return saved;
    }

    private ExpertTask task(String id) {
        return taskRepository.findById(requireText(id, "id"))
                .orElseThrow(() -> new IllegalArgumentException("ExpertTask not found"));
    }

    private String enumValue(String value, String field, Set<String> allowed) {
        String normalized = requireText(value, field).toUpperCase(Locale.ROOT);
        if (!allowed.contains(normalized)) {
            throw new IllegalArgumentException(field + " must be one of " + allowed);
        }
        return normalized;
    }

    private int clampPriority(Integer priority) {
        return priority == null ? 50 : Math.max(1, Math.min(100, priority));
    }

    private LocalDateTime normalizeDueAt(LocalDateTime dueAt) {
        if (dueAt == null) {
            return null;
        }
        if (dueAt.isBefore(LocalDateTime.now())) {
            throw new IllegalArgumentException("dueAt must not be in the past");
        }
        return dueAt;
    }

    private String defaultText(String value, String fallback) {
        return value == null || value.isBlank() ? fallback : value.trim();
    }
}
