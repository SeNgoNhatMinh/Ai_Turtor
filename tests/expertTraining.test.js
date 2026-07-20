import assert from 'node:assert/strict';
import test from 'node:test';
import {
  normalizeCoverageGap,
  normalizeEvalRun,
  normalizeGoldQa,
} from '../src/services/expertTrainingNormalizers.js';
import {
  criteriaRowsToWeights,
  getTaskGoldUsage,
  isTutorV2Reviewer,
  parseChapterInput,
  validateCriteriaWeights,
} from '../src/features/expert-training/expertTrainingUtils.js';
import {
  buildExpertTrainingSummary,
  buildWorkflowSteps,
  getEvaluationReadiness,
  getExpertTrainingNextAction,
  groupReviewQueue,
} from '../src/features/expert-training/expertTrainingSelectors.js';
import { getStatusLabel } from '../src/utils/statusLabels.js';

test('normalizes Tutor V2 coverage and evaluation records without inventing success', () => {
  const gap = normalizeCoverageGap({ chapter: 'JVM Memory', materialCount: '2', status: 'open' });
  assert.equal(gap.materialCount, 2);
  assert.equal(gap.status, 'OPEN');

  const run = normalizeEvalRun({ status: 'failed', averageScore: null, hallucinationRate: '0.25' });
  assert.equal(run.status, 'FAILED');
  assert.equal(run.averageScore, null);
  assert.equal(run.hallucinationRate, 0.25);
});

test('keeps evaluation Gold Q&A as a holdout instead of training knowledge', () => {
  const evaluation = normalizeGoldQa({ usage: 'evaluation', status: 'approved' });
  const training = normalizeGoldQa({ usage: 'training', status: 'indexed' });
  assert.equal(evaluation.holdout, true);
  assert.equal(evaluation.status, 'APPROVED');
  assert.equal(training.holdout, false);
  assert.equal(training.status, 'INDEXED');
});

test('parses unique chapters and validates rubric weights against the backend contract', () => {
  assert.deepEqual(parseChapterInput('JVM Basics\nMemory; JVM Basics, Bytecode'), [
    'JVM Basics',
    'Memory',
    'Bytecode',
  ]);

  const rows = [
    { name: 'accuracy', weight: 0.6 },
    { name: 'groundedness', weight: 0.4 },
  ];
  assert.equal(validateCriteriaWeights(rows), '');
  assert.deepEqual(criteriaRowsToWeights(rows), { accuracy: 0.6, groundedness: 0.4 });
  assert.match(validateCriteriaWeights([{ name: 'accuracy', weight: 0.7 }]), /bằng 1\.0/);
});

test('builds role-aware Tutor V2 priorities from canonical resources', () => {
  const resources = {
    gaps: [{ id: 'gap-1', chapter: 'OOP', severity: 'CRITICAL', status: 'OPEN' }],
    tasks: [{ id: 'task-1', chapter: 'OOP', title: 'Create Gold Q&A', assigneeId: 'teacher-1', status: 'ASSIGNED' }],
    goldQa: [{
      id: 'gold-1',
      chapter: 'OOP',
      question: 'What is inheritance?',
      usage: 'TRAINING',
      status: 'PENDING_REVIEW',
      submittedAt: '2026-07-20T10:00:00Z',
    }],
    rubrics: [],
    evalRuns: [],
  };

  const reviewerAction = getExpertTrainingNextAction(resources, { canReview: true, userId: 'senior-1' });
  const teacherAction = getExpertTrainingNextAction(resources, { canReview: false, userId: 'teacher-1' });
  assert.equal(reviewerAction.reviewId, 'gold-1');
  assert.equal(reviewerAction.view, 'content');
  assert.equal(teacherAction.taskId, 'task-1');
  assert.equal(teacherAction.view, 'work');
});

test('keeps evaluation disabled until an approved holdout exists', () => {
  const unavailable = getEvaluationReadiness({
    goldQa: [{ usage: 'TRAINING', status: 'INDEXED' }],
    rubrics: [],
  });
  assert.equal(unavailable.ready, false);
  assert.match(unavailable.reason, /Evaluation Gold Q&A/);

  const available = getEvaluationReadiness({
    goldQa: [{ usage: 'EVALUATION', status: 'APPROVED', chapter: 'JVM' }],
    rubrics: [{ status: 'APPROVED' }],
  });
  assert.equal(available.ready, true);
  assert.equal(available.holdoutCount, 1);
  assert.deepEqual(available.chapters, ['JVM']);
});

test('summarizes and orders review work without inventing activity', () => {
  const queue = groupReviewQueue(
    [{ id: 'older', status: 'PENDING_REVIEW', submittedAt: '2026-07-19T10:00:00Z' }],
    [{ id: 'newer', status: 'PENDING_REVIEW', submittedAt: '2026-07-20T10:00:00Z' }],
  );
  assert.deepEqual(queue.map((item) => item.id), ['newer', 'older']);

  const resources = {
    gaps: [],
    tasks: [],
    goldQa: [],
    rubrics: [],
    evalRuns: [],
  };
  const summary = buildExpertTrainingSummary(resources);
  const steps = buildWorkflowSteps(resources);
  assert.equal(summary.pendingReviewCount, 0);
  assert.equal(summary.latestEvaluation, null);
  assert.equal(steps[0].state, 'active');
  assert.equal(getStatusLabel('PENDING_REVIEW'), 'Chờ kiểm duyệt');
});

test('allows Tutor V2 approval only for canonical senior and admin roles', () => {
  assert.equal(isTutorV2Reviewer({ role: 'TEACHER' }), false);
  assert.equal(isTutorV2Reviewer({ role: 'SENIOR_MENTOR' }), true);
  assert.equal(isTutorV2Reviewer({ role: 'ADMIN' }), true);
});

test('keeps coverage-created Gold Q&A tasks on their required training purpose', () => {
  assert.equal(getTaskGoldUsage({
    type: 'GOLD_QA',
    title: 'Soan Gold Q&A training',
    instructions: 'Tao du lieu chuan de nap vao RAG Brain.',
  }), 'TRAINING');
  assert.equal(getTaskGoldUsage({
    type: 'GOLD_QA',
    title: 'Soan Gold Q&A holdout',
    instructions: 'Chon usage=EVALUATION.',
  }), 'EVALUATION');
  assert.equal(getTaskGoldUsage({ type: 'GOLD_QA', title: 'Manual contribution' }), null);
  assert.equal(getTaskGoldUsage({ type: 'RUBRIC', title: 'Evaluation rubric' }), null);
});
