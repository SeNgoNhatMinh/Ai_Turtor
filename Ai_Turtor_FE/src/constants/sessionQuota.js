export const DAILY_COURSE_QUESTION_LIMIT_CODE = 'DAILY_COURSE_QUESTION_LIMIT_REACHED';

export const DAILY_COURSE_QUESTION_LIMIT = 10;

export const DAILY_SESSION_COMPLETE_TITLE = 'Phiên học hôm nay đã hết';

export const DAILY_SESSION_COMPLETE_MESSAGE =
  'Phiên học hôm nay của môn này đã hết 10 câu hỏi. Cảm ơn bạn đã học cùng mình. Bạn có thể hỏi môn khác, hoặc quay lại môn này vào ngày mai.';

export function normalizeDailyQuota(payload = {}) {
  const limit = Number(payload.dailyLimit ?? payload.dailyQuestionLimit) > 0
    ? Number(payload.dailyLimit ?? payload.dailyQuestionLimit)
    : DAILY_COURSE_QUESTION_LIMIT;
  const used = Math.max(0, Math.min(limit, Number(payload.used ?? payload.dailyQuestionUsed) || 0));
  const remaining = payload.remaining != null || payload.dailyQuestionRemaining != null
    ? Math.max(0, Number(payload.remaining ?? payload.dailyQuestionRemaining) || 0)
    : Math.max(0, limit - used);
  return {
    courseId: payload.courseId || '',
    used,
    remaining,
    limit,
  };
}

export function isDailyCourseQuotaError(error) {
  if (!error) return false;
  const code = error.code
    || error.details?.code
    || error.details?.response?.code
    || error.details?.body?.code;
  return code === DAILY_COURSE_QUESTION_LIMIT_CODE;
}
