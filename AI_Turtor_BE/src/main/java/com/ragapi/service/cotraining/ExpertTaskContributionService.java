package com.ragapi.service.cotraining;

import com.ragapi.entity.ExpertTask;
import com.ragapi.entity.GoldQa;
import com.ragapi.repository.ExpertTaskRepository;
import com.ragapi.repository.GoldQaRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.Set;

import static com.ragapi.util.ValidationUtils.requireText;

/** Keeps expert-task state synchronized with Gold Q&A and rubric contributions. */
@Service
@RequiredArgsConstructor
public class ExpertTaskContributionService {
    private static final Set<String> EDITABLE_GOLD_STATUSES =
            Set.of("DRAFT", "BASELINE_EXAMINED", "EXAMINED", "REJECTED");

    private final ExpertTaskRepository taskRepository;
    private final GoldQaRepository goldQaRepository;

    public ExpertTask requireOpenTask(String id, String expectedType) {
        if (id == null || id.isBlank()) {
            return null;
        }
        ExpertTask task = taskRepository.findById(requireText(id, "id"))
                .orElseThrow(() -> new IllegalArgumentException("ExpertTask not found"));
        if (!expectedType.equals(task.getType())) {
            throw new IllegalArgumentException("Task type must be " + expectedType);
        }
        if (Set.of("COMPLETED", "CANCELLED").contains(task.getStatus())) {
            throw new IllegalArgumentException("Task is already closed");
        }
        return task;
    }

    public void attachDraft(ExpertTask task, String contributionId) {
        if (task == null) {
            return;
        }
        task.setContributionId(contributionId);
        if (!"SUBMITTED".equals(task.getStatus()) && !"COMPLETED".equals(task.getStatus())) {
            task.setStatus("IN_PROGRESS");
        }
        task.setUpdatedAt(LocalDateTime.now());
        taskRepository.save(task);
    }

    public void markSubmitted(ExpertTask task, String contributionId) {
        if (task == null) {
            return;
        }
        task.setContributionId(contributionId);
        task.setStatus("SUBMITTED");
        task.setUpdatedAt(LocalDateTime.now());
        taskRepository.save(task);
    }

    public void refreshGoldTaskStatus(String taskId, String contributionId) {
        if (taskId == null || taskId.isBlank()) {
            return;
        }
        taskRepository.findById(taskId).ifPresent(task -> refreshGoldTaskStatus(task, contributionId));
    }

    /** A task can contain multiple Gold Q&A contributions, so its status reflects the whole set. */
    public void refreshGoldTaskStatus(ExpertTask task, String contributionId) {
        if (task == null) {
            return;
        }
        if (contributionId != null && !contributionId.isBlank()) {
            task.setContributionId(contributionId);
        }
        List<GoldQa> items = goldQaRepository.findBySourceTaskId(task.getId());
        boolean hasEditable = items.stream().anyMatch(item -> EDITABLE_GOLD_STATUSES.contains(item.getStatus()));
        boolean hasPending = items.stream().anyMatch(item -> "PENDING_REVIEW".equals(item.getStatus()));
        boolean allAccepted = !items.isEmpty() && items.stream().allMatch(item ->
                "INDEXED".equals(item.getStatus())
                        || ("EVALUATION".equalsIgnoreCase(item.getUsage()) && "APPROVED".equals(item.getStatus()))
        );
        if (allAccepted) {
            task.setStatus("COMPLETED");
            task.setCompletedAt(LocalDateTime.now());
        } else if (hasPending && !hasEditable) {
            task.setStatus("SUBMITTED");
            task.setCompletedAt(null);
        } else {
            task.setStatus("IN_PROGRESS");
            task.setCompletedAt(null);
        }
        task.setUpdatedAt(LocalDateTime.now());
        taskRepository.save(task);
    }

    public Optional<GoldQa> resolveEditableGoldQa(String goldQaId, ExpertTask task, String authorId) {
        if (goldQaId == null || goldQaId.isBlank()) {
            return Optional.empty();
        }
        GoldQa existing = goldQaRepository.findById(goldQaId.trim())
                .orElseThrow(() -> new IllegalArgumentException("GoldQA not found"));
        if (!authorId.equals(existing.getAuthorId())) {
            throw new IllegalArgumentException("Only the author can update this Gold Q&A");
        }
        if (task != null && existing.getSourceTaskId() != null
                && !task.getId().equals(existing.getSourceTaskId())) {
            throw new IllegalArgumentException("Gold Q&A does not belong to this task");
        }
        if (!EDITABLE_GOLD_STATUSES.contains(existing.getStatus())) {
            throw new IllegalArgumentException("Gold Q&A cannot be edited in status " + existing.getStatus());
        }
        return Optional.of(existing);
    }

    public void completeReviewedTask(String taskId, boolean approved) {
        if (taskId == null || taskId.isBlank()) {
            return;
        }
        taskRepository.findById(taskId).ifPresent(task -> {
            if (!approved) {
                task.setStatus("IN_PROGRESS");
                task.setCompletedAt(null);
                task.setUpdatedAt(LocalDateTime.now());
                taskRepository.save(task);
                return;
            }
            refreshGoldTaskStatus(task, task.getContributionId());
        });
    }
}
