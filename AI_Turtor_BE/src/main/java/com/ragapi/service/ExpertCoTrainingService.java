package com.ragapi.service;

import com.ragapi.dto.cotraining.*;
import com.ragapi.entity.CoverageGap;
import com.ragapi.entity.EvalRun;
import com.ragapi.entity.ExpertRubric;
import com.ragapi.entity.ExpertTask;
import com.ragapi.entity.GoldQa;
import com.ragapi.service.cotraining.ExpertContributionService;
import com.ragapi.service.cotraining.ExpertCoverageService;
import com.ragapi.service.cotraining.ExpertEvaluationService;
import com.ragapi.service.cotraining.ExpertTaskService;
import com.ragapi.service.cotraining.ExpertTeachingNoteService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;

/** Stable application facade for the expert co-training API. */
@Service
@RequiredArgsConstructor
public class ExpertCoTrainingService {
    private final ExpertCoverageService coverageService;
    private final ExpertTaskService taskService;
    private final ExpertContributionService contributionService;
    private final ExpertTeachingNoteService teachingNoteService;
    private final ExpertEvaluationService evaluationService;

    public List<CoverageGap> analyzeCoverage(CoverageAnalysisRequest request) {
        return coverageService.analyzeCoverage(request);
    }

    public List<CoverageGap> listGaps(String courseId) {
        return coverageService.list(courseId);
    }

    public ExpertTask createTask(CreateExpertTaskRequest request) {
        return taskService.createTask(request);
    }

    public List<ExpertTask> startChapter(CreateChapterTasksRequest request) {
        return taskService.startChapter(request);
    }

    public List<ExpertTask> createChapterTasks(CreateChapterTasksRequest request) {
        return taskService.createChapterTasks(request);
    }

    public List<ExpertTask> listTasks(String status, String courseId, String assigneeId) {
        return taskService.listTasks(status, courseId, assigneeId);
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
        return taskService.searchTasks(
                status, courseId, assigneeId, type, keyword, page, size, sortBy, sortDirection);
    }

    public ExpertTask getTask(String id) {
        return taskService.getTask(id);
    }

    public ExpertTask updateTask(String id, UpdateExpertTaskRequest request) {
        return taskService.updateTask(id, request);
    }

    public void deleteTask(String id) {
        taskService.deleteTask(id);
    }

    public ExpertTask assignTask(String id, AssignExpertTaskRequest request) {
        return taskService.assignTask(id, request);
    }

    public GoldQa submitGoldQa(SubmitGoldQaRequest request) {
        return contributionService.submitGoldQa(request);
    }

    public GoldQa examGoldQa(String id) {
        return contributionService.examGoldQa(id);
    }

    public void deleteGoldQa(String id, String authorId) {
        contributionService.deleteGoldQa(id, authorId);
    }

    public GoldQa submitGoldQaAndExam(SubmitGoldQaRequest request) {
        return contributionService.submitGoldQaAndExam(request);
    }

    public GoldQa sendGoldQaForReview(String id) {
        return contributionService.sendGoldQaForReview(id);
    }

    public List<GoldQa> listGoldQa(String courseId, String usage, String status) {
        return contributionService.listGoldQa(courseId, usage, status);
    }

    public GoldQa reviewGoldQa(String id, ExpertReviewRequest request, boolean approve) throws Exception {
        return contributionService.reviewGoldQa(id, request, approve);
    }

    public ExpertRubric submitRubric(SubmitRubricRequest request) {
        return contributionService.submitRubric(request);
    }

    public ExpertRubric reviewRubric(String id, ExpertReviewRequest request, boolean approve) {
        return contributionService.reviewRubric(id, request, approve);
    }

    public List<ExpertRubric> listRubrics(String courseId) {
        return contributionService.listRubrics(courseId);
    }

    public List<GoldQa> listIndexedTeachingNotes(String courseId, String status) {
        return teachingNoteService.list(courseId, status);
    }

    public boolean isManagedTeachingNote(String id) {
        return teachingNoteService.manages(id);
    }

    public GoldQa updateIndexedTeachingNote(String id, UpdateIndexedTeachingNoteRequest request) throws Exception {
        return teachingNoteService.update(id, request);
    }

    public GoldQa reindexTeachingNote(String id) throws Exception {
        return teachingNoteService.reindex(id);
    }

    public GoldQa unindexTeachingNote(String id) throws Exception {
        return teachingNoteService.unindex(id);
    }

    public void deleteIndexedTeachingNote(String id) throws Exception {
        teachingNoteService.delete(id);
    }

    public void onTeachingNoteMaterialDeleted(String materialId) {
        teachingNoteService.onMaterialDeleted(materialId);
    }

    public EvalRun runEvaluation(StartEvalRunRequest request) {
        return evaluationService.run(request);
    }

    public List<EvalRun> listEvalRuns(String courseId) {
        return evaluationService.listRuns(courseId);
    }

    public Map<String, Object> evalRunDetail(String id) {
        return evaluationService.runDetail(id);
    }
}
