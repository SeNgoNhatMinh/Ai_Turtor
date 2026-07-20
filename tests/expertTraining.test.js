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
  assert.match(validateCriteriaWeights([{ name: 'accuracy', weight: 0.7 }]), /total 1\.0/);
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
