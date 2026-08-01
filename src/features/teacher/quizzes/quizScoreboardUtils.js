import { getPersonDisplayName, getPersonId } from '../../../utils/displayNames.js';
import { normalizeQuizStatus } from '../../student/quizzes/practiceQuizUtils.js';

const asTime = (value) => {
  const time = new Date(value || 0).getTime();
  return Number.isFinite(time) ? time : 0;
};

function getQuizAssignmentTargetStudents(assignment, classStudents = []) {
  const targetType = String(assignment?.targetType || 'CLASS').toUpperCase();
  const roster = Array.isArray(classStudents) ? classStudents : [];
  if (targetType === 'SELECTED_STUDENTS') {
    const ids = new Set(
      (Array.isArray(assignment?.targetStudentIds) ? assignment.targetStudentIds : [])
        .map((id) => String(id || '').trim())
        .filter(Boolean),
    );
    return roster.filter((student) => ids.has(getPersonId(student)));
  }
  return roster;
}

export function getTeacherQuizAttemptRowStatus(attempt) {
  if (!attempt) {
    return { label: 'Chưa làm', tone: 'default' };
  }
  const status = normalizeQuizStatus(attempt.status);
  const reviewStatus = normalizeQuizStatus(attempt.teacherReviewStatus);
  if (status === 'GENERATED') {
    return { label: 'Đang làm', tone: 'processing' };
  }
  if (reviewStatus === 'REVIEWED') {
    return { label: 'Đã chấm', tone: 'success' };
  }
  if (status === 'SUBMITTED') {
    return { label: 'Đã nộp · Chờ chấm', tone: 'warning' };
  }
  return { label: status || '—', tone: 'default' };
}

function formatQuizScoreboardScore(attempt) {
  if (!attempt) return '—';
  const maxScore = Number(attempt.maxScore);
  const finalScore = attempt.finalScore ?? attempt.teacherReviewedScore ?? attempt.score ?? attempt.autoScore;
  if (finalScore == null || Number.isNaN(Number(finalScore))) {
    return Number.isFinite(maxScore) && maxScore > 0 ? `— / ${maxScore}` : '—';
  }
  return Number.isFinite(maxScore) && maxScore > 0
    ? `${finalScore} / ${maxScore}`
    : String(finalScore);
}

function formatQuizScoreboardPercent(attempt) {
  if (!attempt) return '—';
  const value = attempt.finalPercentage ?? attempt.percentage ?? attempt.autoPercentage;
  if (value == null || Number.isNaN(Number(value))) return '—';
  return `${Math.round(Number(value))}%`;
}

export function buildQuizScoreboardRows(assignment, attempts = [], classStudents = []) {
  const targets = getQuizAssignmentTargetStudents(assignment, classStudents);
  const studentById = new Map(targets.map((student) => [getPersonId(student), student]));
  const latestAttemptByStudent = new Map();

  (Array.isArray(attempts) ? attempts : []).forEach((attempt) => {
    const studentId = String(attempt?.studentId || '').trim();
    if (!studentId) return;
    const previous = latestAttemptByStudent.get(studentId);
    if (!previous || asTime(attempt.submittedAt || attempt.updatedAt) >= asTime(previous.submittedAt || previous.updatedAt)) {
      latestAttemptByStudent.set(studentId, attempt);
    }
  });

  const studentIds = new Set([
    ...targets.map((student) => getPersonId(student)).filter(Boolean),
    ...latestAttemptByStudent.keys(),
  ]);

  return [...studentIds]
    .filter(Boolean)
    .map((studentId) => {
      const student = studentById.get(studentId);
      const attempt = latestAttemptByStudent.get(studentId) || null;
      const rowStatus = getTeacherQuizAttemptRowStatus(attempt);
      return {
        key: studentId,
        studentId,
        studentName: getPersonDisplayName(student, studentId),
        attempt,
        statusLabel: rowStatus.label,
        statusTone: rowStatus.tone,
        scoreLabel: formatQuizScoreboardScore(attempt),
        percentLabel: formatQuizScoreboardPercent(attempt),
        submittedAt: attempt?.submittedAt || '',
      };
    })
    .sort((left, right) => left.studentName.localeCompare(right.studentName, 'vi'));
}

export function summarizeQuizScoreboard(rows = []) {
  const list = Array.isArray(rows) ? rows : [];
  const submitted = list.filter((row) => row.attempt && normalizeQuizStatus(row.attempt.status) !== 'GENERATED');
  const graded = list.filter((row) => normalizeQuizStatus(row.attempt?.teacherReviewStatus) === 'REVIEWED');
  const pending = submitted.filter((row) => normalizeQuizStatus(row.attempt?.teacherReviewStatus) === 'PENDING');
  const notStarted = list.filter((row) => !row.attempt);

  return {
    total: list.length,
    submitted: submitted.length,
    graded: graded.length,
    pending: pending.length,
    notStarted: notStarted.length,
  };
}
