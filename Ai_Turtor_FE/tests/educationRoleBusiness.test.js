import assert from 'node:assert/strict';
import test from 'node:test';
import { appRoutes, getHomeRouteForRole, getRouteState } from '../src/app/routes.js';
import { groupTeacherExpertTasks } from '../src/features/expert-training/expertTaskBoardUtils.js';
import { isTutorV2Reviewer } from '../src/features/expert-training/expertTrainingUtils.js';
import {
  buildExpertTrainingSummary,
  getEvaluationReadiness,
  getExpertTrainingNextAction,
} from '../src/features/expert-training/expertTrainingSelectors.js';
import {
  buildQuizScoreboardRows,
  getTeacherQuizAttemptRowStatus,
} from '../src/features/teacher/quizzes/quizScoreboardUtils.js';
import { buildStudentNextSteps } from '../src/features/student/learning/studentNextStepUtils.js';
import {
  FEEDBACK_ACTIONS,
  getFeedbackActionKeyForStar,
} from '../src/constants/answerReview.js';
import { isQuizDraft } from '../src/features/teacher/quizzes/quizAssignmentUtils.js';

const roles = ['STUDENT', 'TEACHER', 'SENIOR_MENTOR', 'ADMIN'];

test('education routes: each role has a home and student cannot open expert-training shells', () => {
  assert.equal(getHomeRouteForRole('STUDENT'), '/student/dashboard');
  assert.equal(getHomeRouteForRole('TEACHER'), '/teacher/classes');
  assert.equal(getHomeRouteForRole('SENIOR_MENTOR'), '/senior/review');
  assert.equal(getHomeRouteForRole('ADMIN'), '/admin/dashboard');

  const studentPaths = appRoutes.filter((route) => route.role === 'student').map((route) => route.path);
  const teacherExpert = appRoutes.filter((route) => route.tab === 'teacher-expert-training');
  assert.ok(studentPaths.every((path) => path.startsWith('/student/')));
  assert.ok(teacherExpert.every((route) => route.allowedAccountRoles?.includes('TEACHER')));
  assert.equal(getRouteState('/student/chat')?.role, 'student');
  assert.equal(getRouteState('/admin/v2'), null);
});

test('education navigation tabs stay within each workspace role', () => {
  const tabsForRole = (role) => new Set(
    appRoutes.filter((route) => route.role === role && route.navigationPath !== false).map((route) => route.tab),
  );
  const studentTabs = tabsForRole('student');
  const teacherTabs = tabsForRole('teacher');
  const seniorTabs = tabsForRole('senior');
  const adminTabs = tabsForRole('admin');

  assert.ok(studentTabs.has('student-quizzes'));
  assert.ok(studentTabs.has('student-chat'));
  assert.ok(!studentTabs.has('teacher-expert-training'));
  assert.ok(teacherTabs.has('teacher-quizzes'));
  assert.ok(teacherTabs.has('teacher-grading'));
  assert.ok(teacherTabs.has('teacher-expert-training'));
  assert.ok(!teacherTabs.has('senior-review'));
  assert.ok(seniorTabs.has('senior-review'));
  assert.ok(!seniorTabs.has('senior-indexed-notes'));
  assert.ok(seniorTabs.has('senior-v2'));
  assert.ok(!seniorTabs.has('admin-users'));
  assert.ok(!adminTabs.has('admin-review'));
  assert.ok(adminTabs.has('admin-ai-logs'));
  assert.ok(!adminTabs.has('admin-expert-training'));
  assert.ok(!adminTabs.has('senior-review'));
});

test('student next steps surface pending quizzes and assignments without completed noise', () => {
  const steps = buildStudentNextSteps({
    assignedQuizzes: [{ id: 'qa-1', assignmentId: 'qa-1', title: 'Midterm', status: 'PUBLISHED' }],
    quizHistory: [],
    assignments: [{ id: 'a1', title: 'Lab 1', status: 'OPEN' }],
    submissions: [],
  });
  assert.ok(steps.some((step) => String(step.key).includes('qa-1')));
  assert.ok(steps.some((step) => String(step.key).includes('a1')));

  const afterAttempt = buildStudentNextSteps({
    assignedQuizzes: [{ id: 'qa-1', assignmentId: 'qa-1', title: 'Midterm', status: 'PUBLISHED' }],
    quizHistory: [{ assignmentId: 'qa-1', status: 'SUBMITTED' }],
    assignments: [],
    submissions: [],
  });
  assert.ok(!afterAttempt.some((step) => String(step.key).includes('assigned-quiz:qa-1')));
});

test('student answer feedback follows education escalation tiers', () => {
  assert.equal(getFeedbackActionKeyForStar(5), 'helpful');
  assert.equal(FEEDBACK_ACTIONS[getFeedbackActionKeyForStar(2)].reviewType, 'ANSWER_DISPUTE');
  assert.equal(FEEDBACK_ACTIONS[getFeedbackActionKeyForStar(1)].reviewType, 'ANSWER_DISPUTE');
  assert.equal(FEEDBACK_ACTIONS.sourceConflict.reviewType, 'SOURCE_CONFLICT');
});

test('teacher quiz workflow: drafts stay editable, published attempts feed scoreboard', () => {
  assert.equal(isQuizDraft({ status: 'DRAFT' }), true);
  assert.equal(isQuizDraft({ status: 'PUBLISHED' }), false);

  const rows = buildQuizScoreboardRows(
    { targetType: 'CLASS' },
    [{
      studentId: 's1',
      status: 'SUBMITTED',
      teacherReviewStatus: 'PENDING',
      finalScore: 7,
      maxScore: 10,
      finalPercentage: 70,
      submittedAt: '2026-07-01T08:00:00Z',
    }],
    [{ id: 's1', fullName: 'Lan' }, { id: 's2', fullName: 'Minh' }],
  );
  assert.equal(getTeacherQuizAttemptRowStatus(rows[0].attempt).label, 'Đã nộp · Chờ chấm');
  assert.equal(rows.find((row) => row.studentId === 's2').statusLabel, 'Chưa làm');
});

test('teacher expert tasks split open pool, active work, and completed contributions', () => {
  const teacherId = 't-1';
  const tasks = [
    { id: '1', type: 'GOLD_QA', status: 'OPEN', priority: 2 },
    { id: '2', type: 'GOLD_QA', status: 'ASSIGNED', assigneeId: teacherId, priority: 1 },
    { id: '3', type: 'GOLD_QA', status: 'SUBMITTED', assigneeId: teacherId },
    { id: '4', type: 'GOLD_QA', status: 'COMPLETED', assigneeId: teacherId },
    { id: '5', type: 'GOLD_QA', status: 'ASSIGNED', assigneeId: 'other-teacher' },
  ];
  const groups = groupTeacherExpertTasks(tasks, teacherId);
  assert.deepEqual(groups.TODO.map((task) => task.id), ['1']);
  assert.deepEqual(groups.DOING.map((task) => task.id), ['2', '3']);
  assert.deepEqual(groups.DONE.map((task) => task.id), ['4']);
});

test('senior and admin quality gates: review priority and evaluation readiness', () => {
  roles.forEach((role) => {
    if (role === 'TEACHER') assert.equal(isTutorV2Reviewer({ role }), false);
    if (role === 'SENIOR_MENTOR' || role === 'ADMIN') assert.equal(isTutorV2Reviewer({ role }), true);
  });

  const resources = {
    gaps: [],
    tasks: [],
    goldQa: [{ id: 'g1', status: 'PENDING_REVIEW', submittedAt: '2026-07-21T09:00:00Z' }],
    rubrics: [],
    evalRuns: [],
  };
  const seniorNext = getExpertTrainingNextAction(resources, { canReview: true, userId: 'senior-1' });
  assert.equal(seniorNext.view, 'content');
  assert.equal(seniorNext.reviewId, 'g1');

  const readiness = getEvaluationReadiness({
    goldQa: [{ usage: 'EVALUATION', status: 'APPROVED', chapter: 'OOP' }],
    rubrics: [],
  });
  assert.equal(readiness.ready, true);
  const summary = buildExpertTrainingSummary({
    gaps: [{ status: 'OPEN' }],
    tasks: [{ status: 'OPEN' }, { status: 'COMPLETED' }],
    goldQa: [{ status: 'PENDING_REVIEW', usage: 'TRAINING' }],
    rubrics: [],
    evalRuns: [],
  });
  assert.equal(summary.gapCount, 1);
  assert.equal(summary.activeTaskCount, 1);
  assert.equal(summary.completedTaskCount, 1);
  assert.equal(summary.pendingReviewCount, 1);
});
