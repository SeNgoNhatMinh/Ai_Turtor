export const getSuggestionText = (suggestion) => (
  suggestion?.title || suggestion?.content || String(suggestion || '')
);

export const getQuizId = (quiz) => quiz?.quizSessionId || quiz?.sessionId || quiz?.id;

export const getAssignmentId = (assignment) => assignment?.assignmentId || assignment?.id;

export const normalizeQuizStatus = (status) => String(status || '').toUpperCase();

export const asQuizArray = (value) => (Array.isArray(value) ? value : []);

export function getQuizStatusColor(status) {
  const normalized = normalizeQuizStatus(status);
  if (normalized.includes('SUBMITTED') || normalized.includes('REVIEWED')) return 'success';
  if (normalized.includes('GENERATED') || normalized.includes('DRAFT')) return 'processing';
  if (normalized.includes('PUBLISHED') || normalized.includes('ASSIGNED')) return 'blue';
  return 'default';
}

export function formatQuizDateTime(value) {
  if (!value) return 'No activity yet';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'No activity yet';
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function getQuizStatusLabel(item) {
  const reviewStatus = normalizeQuizStatus(item?.teacherReviewStatus || item?.reviewStatus || item?.status);
  const status = normalizeQuizStatus(item?.status);
  if (reviewStatus.includes('REVIEWED')) return 'Teacher reviewed';
  if (reviewStatus.includes('PENDING') || reviewStatus.includes('WAIT')) return 'Waiting teacher review';
  if (status === 'SUBMITTED') return item?.quizType === 'ASSIGNED' ? 'Submitted - waiting review' : 'Submitted';
  if (status === 'GENERATED') return 'In progress';
  if (status === 'PUBLISHED') return 'Published';
  return item?.status || 'Available';
}

export function getQuizScoreText(item) {
  if (item?.score == null && item?.autoScore == null && item?.teacherReviewedScore == null) {
    return 'Not submitted yet';
  }
  const score = item.teacherReviewedScore ?? item.score ?? item.autoScore ?? 0;
  const maxScore = item.maxScore ?? item.totalScore ?? item.questionCount ?? '-';
  return `Score ${score}/${maxScore}`;
}

export function getQuizQuestionCount(item) {
  if (item?.questionCount) return item.questionCount;
  if (Array.isArray(item?.questions)) return item.questions.length;
  return null;
}

export function sortQuizHistory(history) {
  return [...asQuizArray(history)].sort((a, b) => (
    new Date(b.updatedAt || b.submittedAt || b.createdAt || 0)
      - new Date(a.updatedAt || a.submittedAt || a.createdAt || 0)
  ));
}
