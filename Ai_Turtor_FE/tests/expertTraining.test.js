import assert from 'node:assert/strict';
import test from 'node:test';
import {
  normalizeChapterOutline,
  normalizeChapterPreview,
  normalizeCoverageGap,
  normalizeEvalRun,
  normalizeGoldQa,
} from '../src/services/expertTrainingNormalizers.js';
import {
  criteriaRowsToWeights,
  defaultExpertTaskDueAt,
  getChapterStatusMeta,
  getExpertTaskDueMeta,
  getTaskGoldUsage,
  isTutorV2Reviewer,
  parseChapterInput,
  toExpertTaskDueAtPayload,
  validateCriteriaWeights,
} from '../src/features/expert-training/expertTrainingUtils.js';
import {
  cleanChapterExcerptRaw,
  inferExcerptLanguage,
  looksLikeCodeText,
  normalizeCodeNewlines,
  parseChapterExcerptBlocks,
} from '../src/features/expert-training/chapterExcerptFormat.js';
import {
  buildExpertTrainingSummary,
  buildWorkflowSteps,
  getEvaluationReadiness,
  getExpertTrainingNextAction,
  groupReviewQueue,
} from '../src/features/expert-training/expertTrainingSelectors.js';
import {
  buildTeacherGoldQaSummary,
  findTaskGoldQa,
  groupTeacherExpertTasks,
} from '../src/features/expert-training/expertTaskBoardUtils.js';
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

test('normalizes canonical chapter coverage and source material metadata', () => {
  const chapter = normalizeChapterOutline({
    chapterKey: 'jvm-memory',
    title: 'JVM Memory',
    status: 'confirmed',
    chunkCount: '4',
    sourceMaterialIds: ['pdf-1', 'pdf-1', ''],
  });
  const preview = normalizeChapterPreview({
    chapterKey: 'jvm-memory',
    hasMaterialContent: true,
    sourceMaterials: [{ materialId: 'pdf-1', fileName: 'JVM.pdf', sourceType: 'pdf' }],
  });

  assert.equal(chapter.status, 'CONFIRMED');
  assert.equal(chapter.chunkCount, 4);
  assert.deepEqual(chapter.sourceMaterialIds, ['pdf-1']);
  assert.equal(preview.sourceMaterials[0].title, 'JVM.pdf');
  assert.equal(getChapterStatusMeta(chapter.status).label, 'Đã xác nhận');
});

test('formats chapter excerpts for readable teacher and senior review', () => {
  const raw = '2 Using Web Containers In This Chapter >> Choosing a web container >> Installing Tomcat c02.indd 19 24-02-2014 13:02:52 20 | CHapTer 2 on your machine.';
  const cleaned = cleanChapterExcerptRaw(raw);
  assert.ok(!cleaned.includes('c02.indd'));
  assert.ok(!cleaned.includes('| CHapTer'));

  const blocks = parseChapterExcerptBlocks(raw);
  assert.ok(blocks.some((block) => block.type === 'list-item' && block.text.includes('Choosing a web container')));
  assert.ok(blocks.some((block) => block.type === 'list-item' && block.text.includes('Installing Tomcat')));
});

test('splits JSP excerpts into highlighted code blocks', () => {
  const raw = 'A Note about JSP Documents (JSPX) <%@ page contentType="text/html" %> <%! int x = 1; %> <% out.print(x); %>';
  assert.equal(looksLikeCodeText(raw), true);
  assert.equal(looksLikeCodeText('A Note about JSP Documents (JSPX) only prose here.'), false);
  const formatted = normalizeCodeNewlines(raw);
  assert.ok(formatted.includes('\n<%@'));
  assert.equal(inferExcerptLanguage('<%@ page %>'), 'markup');

  const blocks = parseChapterExcerptBlocks(raw);
  assert.ok(blocks.some((block) => block.type === 'heading' && block.text.includes('JSP Documents')));
  const codeBlock = blocks.find((block) => block.type === 'code');
  assert.ok(codeBlock);
  assert.ok(codeBlock.text.includes('<%@ page'));
  assert.ok(codeBlock.text.includes('\n'));
});

test('formats JSPX listing with readable code block inside excerpt scroll', () => {
  const raw = '<?xml version="1.0"?><jsp:root xmlns:jsp="test"><jsp:directive.page contentType="text/html"/></jsp:root>';
  const blocks = parseChapterExcerptBlocks(raw);
  assert.equal(blocks[0]?.type, 'code');
  assert.ok(blocks[0]?.text.includes('<jsp:directive'));
});

test('expert task due helpers format schedule for teachers', () => {
  const dueAt = defaultExpertTaskDueAt(3);
  assert.ok(toExpertTaskDueAtPayload(dueAt));
  const overdue = getExpertTaskDueMeta({
    status: 'ASSIGNED',
    dueAt: '2020-01-01T12:00:00.000Z',
  });
  assert.equal(overdue.overdue, true);
  assert.match(overdue.label, /Quá hạn/);
});

test('normalizes gold Q&A exam fields without treating them as holdout knowledge', () => {
  const pending = normalizeGoldQa({
    usage: 'training',
    status: 'pending_review',
    examPassed: true,
    examScore: 0.82,
  });
  const indexed = normalizeGoldQa({ usage: 'training', status: 'indexed' });
  assert.equal(pending.holdout, false);
  assert.equal(pending.examPassed, true);
  assert.equal(pending.examScore, 0.82);
  assert.equal(pending.status, 'PENDING_REVIEW');
  assert.equal(indexed.status, 'INDEXED');
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

test('gold Q&A tasks are always training questions for the chapter exam', () => {
  assert.equal(getTaskGoldUsage({
    type: 'GOLD_QA',
    title: 'Q&A vàng 1/2',
    instructions: 'Viết câu hỏi vàng theo giáo trình.',
  }), 'TRAINING');
  assert.equal(getTaskGoldUsage({ type: 'GOLD_QA', title: 'Manual contribution' }), 'TRAINING');
  assert.equal(getTaskGoldUsage({ type: 'RUBRIC', title: 'Evaluation rubric' }), null);
});

test('Teacher task board follows only GOLD_QA tasks created from the Senior flow', () => {
  const tasks = [
    { id: 'open-1', type: 'GOLD_QA', status: 'OPEN', chapter: 'Recursion' },
    { id: 'mine-1', type: 'GOLD_QA', status: 'SUBMITTED', assigneeId: 'teacher-1', chapter: 'Recursion' },
    { id: 'done-1', type: 'GOLD_QA', status: 'COMPLETED', assigneeId: 'teacher-1', chapter: 'Loops' },
    { id: 'rubric-1', type: 'RUBRIC', status: 'OPEN', chapter: 'Legacy' },
  ];
  const goldQa = [
    { id: 'gold-old', sourceTaskId: 'mine-1', status: 'REJECTED', updatedAt: '2026-08-19T08:00:00Z' },
    { id: 'gold-new', sourceTaskId: 'mine-1', status: 'PENDING_REVIEW', updatedAt: '2026-08-20T08:00:00Z' },
    { id: 'gold-done', sourceTaskId: 'done-1', status: 'INDEXED', updatedAt: '2026-08-20T09:00:00Z' },
  ];

  const groups = groupTeacherExpertTasks(tasks, 'teacher-1');
  const summary = buildTeacherGoldQaSummary(tasks, goldQa, 'teacher-1');

  assert.deepEqual(groups.TODO.map((item) => item.id), ['open-1']);
  assert.deepEqual(groups.DOING.map((item) => item.id), ['mine-1']);
  assert.deepEqual(groups.DONE.map((item) => item.id), ['done-1']);
  assert.equal(findTaskGoldQa(tasks[1], goldQa).id, 'gold-new');
  assert.equal(summary.pendingReview, 1);
  assert.equal(summary.indexed, 1);
});
