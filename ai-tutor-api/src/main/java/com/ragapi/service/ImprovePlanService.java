package com.ragapi.service;

import com.ragapi.entity.AssignmentSubmission;
import com.ragapi.entity.ImprovePlan;
import com.ragapi.entity.StudentCourseMemory;
import com.ragapi.repository.AssignmentSubmissionRepository;
import com.ragapi.repository.ImprovePlanRepository;
import lombok.AllArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;

@Service
@AllArgsConstructor
public class ImprovePlanService {

    private final ImprovePlanRepository improvePlanRepository;
    private final AssignmentSubmissionRepository submissionRepository;

    public ImprovePlan generateOrUpdatePlan(StudentCourseMemory memory, String generatedBy) {
        if (memory == null || isBlank(memory.getStudentId()) || isBlank(memory.getCourseId())) {
            throw new IllegalArgumentException("studentId and courseId are required to generate improve plan");
        }

        List<AssignmentSubmission> submissions = submissionRepository.findByStudentId(memory.getStudentId()).stream()
                .filter(item -> memory.getCourseId().equals(item.getCourseId()))
                .toList();

        Set<String> weakTopics = new LinkedHashSet<>();
        if (memory.getWeakTopics() != null) weakTopics.addAll(memory.getWeakTopics());
        submissions.stream()
                .filter(item -> item.getWeakTopics() != null)
                .flatMap(item -> item.getWeakTopics().stream())
                .forEach(weakTopics::add);

        List<String> evidence = new ArrayList<>();
        if (memory.getRecentQuestions() != null && !memory.getRecentQuestions().isEmpty()) {
            evidence.add("Recent questions: " + Math.min(memory.getRecentQuestions().size(), 20));
        }
        submissions.stream()
                .filter(item -> item.getScore() != null)
                .forEach(item -> evidence.add("Assignment score: " + item.getScore() + " for submission " + item.getId()));
        if (memory.getImproveSuggestions() != null) {
            memory.getImproveSuggestions().stream()
                    .filter(item -> item != null && !item.isBlank())
                    .forEach(item -> evidence.add("Feedback: " + item));
        }

        List<String> planItems = buildPlanItems(weakTopics, submissions);
        String riskLevel = calculateRiskLevel(weakTopics.size(), submissions);
        LocalDateTime now = LocalDateTime.now();

        ImprovePlan plan = improvePlanRepository
                .findFirstByStudentIdAndCourseIdAndStatusOrderByGeneratedAtDesc(memory.getStudentId(), memory.getCourseId(), "ACTIVE")
                .orElseGet(() -> ImprovePlan.builder()
                        .id(UUID.randomUUID().toString())
                        .studentId(memory.getStudentId())
                        .courseId(memory.getCourseId())
                        .createdAt(now)
                        .status("ACTIVE")
                        .build());

        plan.setClassId(memory.getClassId());
        plan.setRiskLevel(riskLevel);
        plan.setWeakTopics(new ArrayList<>(weakTopics));
        plan.setPlanItems(planItems);
        plan.setEvidence(evidence);
        plan.setGeneratedBy(isBlank(generatedBy) ? "SYSTEM" : generatedBy.trim());
        plan.setGeneratedAt(now);
        plan.setUpdatedAt(now);
        return improvePlanRepository.save(plan);
    }

    public List<ImprovePlan> listPlans(String studentId, String courseId) {
        if (isBlank(studentId)) {
            throw new IllegalArgumentException("studentId is required");
        }
        if (!isBlank(courseId)) {
            return improvePlanRepository.findByStudentIdAndCourseId(studentId.trim(), courseId.trim());
        }
        return improvePlanRepository.findByStudentId(studentId.trim());
    }

    public ImprovePlan getLatestActivePlan(String studentId, String courseId) {
        if (isBlank(studentId) || isBlank(courseId)) {
            throw new IllegalArgumentException("studentId and courseId are required");
        }
        return improvePlanRepository
                .findFirstByStudentIdAndCourseIdAndStatusOrderByGeneratedAtDesc(studentId.trim(), courseId.trim(), "ACTIVE")
                .orElse(null);
    }

    public ImprovePlan completePlan(String planId) {
        ImprovePlan plan = improvePlanRepository.findById(planId)
                .orElseThrow(() -> new IllegalArgumentException("Improve plan not found"));
        plan.setStatus("COMPLETED");
        plan.setCompletedAt(LocalDateTime.now());
        plan.setUpdatedAt(LocalDateTime.now());
        return improvePlanRepository.save(plan);
    }

    private List<String> buildPlanItems(Set<String> weakTopics, List<AssignmentSubmission> submissions) {
        List<String> items = new ArrayList<>();
        for (String topic : weakTopics) {
            if (topic != null && !topic.isBlank()) {
                items.add("Review " + topic.trim());
                items.add("Do one small practice exercise about " + topic.trim());
            }
        }
        boolean hasLowScore = submissions.stream()
                .anyMatch(item -> item.getScore() != null && item.getScore() < 5.0);
        if (hasLowScore) {
            items.add("Revisit teacher feedback for low-score submissions");
            items.add("Ask AI Tutor to explain the weakest assignment topic step by step");
        }
        if (items.isEmpty()) {
            items.add("Review recent course materials");
            items.add("Ask AI Tutor for a short checklist before the next quiz or assignment");
        }
        return items.stream().distinct().toList();
    }

    private String calculateRiskLevel(int weakTopicCount, List<AssignmentSubmission> submissions) {
        long lowScores = submissions.stream()
                .filter(item -> item.getScore() != null && item.getScore() < 5.0)
                .count();
        if (weakTopicCount >= 4 || lowScores >= 2) return "HIGH";
        if (weakTopicCount >= 2 || lowScores == 1) return "MEDIUM";
        return "LOW";
    }

    private boolean isBlank(String value) {
        return value == null || value.isBlank();
    }
}