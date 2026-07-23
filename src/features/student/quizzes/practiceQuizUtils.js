export const getSuggestionText = (suggestion) => (
  suggestion?.title || suggestion?.content || String(suggestion || '')
);

export const getQuizId = (quiz) => quiz?.quizSessionId || quiz?.sessionId || quiz?.id;

export const getAssignmentId = (assignment) => assignment?.assignmentId || assignment?.id;

export const normalizeQuizStatus = (status) => String(status || '').toUpperCase();

export const asQuizArray = (value) => (Array.isArray(value) ? value : []);

export const MIN_QUIZ_QUESTION_COUNT = 3;
export const MAX_QUIZ_QUESTION_COUNT = 10;
const DEFAULT_QUIZ_QUESTION_COUNT = 5;

export function normalizeQuizQuestionCount(value, fallback = DEFAULT_QUIZ_QUESTION_COUNT) {
  const safeFallback = Number.isFinite(Number(fallback))
    ? Math.round(Number(fallback))
    : DEFAULT_QUIZ_QUESTION_COUNT;
  const parsed = value == null || value === '' ? Number.NaN : Number(value);
  const integer = Number.isFinite(parsed) ? Math.round(parsed) : safeFallback;
  return Math.min(MAX_QUIZ_QUESTION_COUNT, Math.max(MIN_QUIZ_QUESTION_COUNT, integer));
}

export function getQuizStatusColor(status) {
  const normalized = normalizeQuizStatus(status);
  if (normalized.includes('SUBMITTED') || normalized.includes('REVIEWED')) return 'success';
  if (normalized.includes('GENERATED') || normalized.includes('DRAFT')) return 'processing';
  if (normalized.includes('PUBLISHED') || normalized.includes('ASSIGNED')) return 'blue';
  return 'default';
}

export function formatQuizDateTime(value) {
  if (!value) return 'Chưa có hoạt động';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Chưa có hoạt động';
  return date.toLocaleString('vi-VN', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function getQuizStatusLabel(item) {
  const reviewStatus = normalizeQuizStatus(item?.teacherReviewStatus || item?.reviewStatus || item?.status);
  const status = normalizeQuizStatus(item?.status);
  if (reviewStatus.includes('REVIEWED')) return 'Giảng viên đã duyệt';
  if (reviewStatus.includes('PENDING') || reviewStatus.includes('WAIT')) return 'Chờ giảng viên duyệt';
  if (status === 'SUBMITTED') return item?.quizType === 'ASSIGNED' ? 'Đã nộp · Chờ duyệt' : 'Đã nộp';
  if (status === 'GENERATED') return 'Đang làm';
  if (status === 'PUBLISHED') return 'Đã xuất bản';
  return item?.status || 'Có thể làm';
}

export function getQuizScoreText(item) {
  if (item?.score == null && item?.autoScore == null && item?.teacherReviewedScore == null) {
    return 'Chưa nộp';
  }
  const score = item.teacherReviewedScore ?? item.score ?? item.autoScore ?? 0;
  const maxScore = item.maxScore ?? item.totalScore ?? item.questionCount ?? '-';
  return `Điểm ${score}/${maxScore}`;
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
