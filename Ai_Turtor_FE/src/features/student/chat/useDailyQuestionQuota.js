import { useQuery, useQueryClient } from '@tanstack/react-query';
import { DAILY_COURSE_QUESTION_LIMIT, normalizeDailyQuota } from '../../../constants/sessionQuota';
import { aiTutorApi } from '../../../services/aiTutorApi';
import { queryKeys } from '../../../app/queryKeys';

const DEFAULT_QUOTA = {
  used: 0,
  remaining: DAILY_COURSE_QUESTION_LIMIT,
  limit: DAILY_COURSE_QUESTION_LIMIT,
};

const hasQuotaPayload = (payload) => (
  payload != null
  && (
    payload.dailyQuestionUsed != null
    || payload.used != null
    || payload.dailyQuestionRemaining != null
    || payload.remaining != null
  )
);

const createQuotaQuery = (studentId, courseId) => ({
  queryKey: queryKeys.studentQuestionQuota(studentId, courseId),
  queryFn: async ({ signal }) => normalizeDailyQuota(await aiTutorApi.getQuestionQuota(
    studentId,
    courseId,
    {
      signal,
      retries: 0,
      skipUnauthorizedRedirect: true,
    },
  )),
  enabled: Boolean(studentId && courseId),
});

export function useDailyQuestionQuota({ userId, studentId, courseId }) {
  const queryClient = useQueryClient();
  const resolvedStudentId = String(userId || studentId || '').trim();
  const resolvedCourseId = String(courseId || '').trim();
  const queryOptions = createQuotaQuery(resolvedStudentId, resolvedCourseId);
  const quotaQuery = useQuery(queryOptions);
  const dailyQuota = quotaQuery.data || DEFAULT_QUOTA;

  const applyQuotaPayload = (payload) => {
    if (!hasQuotaPayload(payload)) return null;
    const nextQuota = normalizeDailyQuota(payload);
    queryClient.setQueryData(queryOptions.queryKey, nextQuota);
    return nextQuota;
  };

  const refreshDailyQuota = async () => {
    if (!queryOptions.enabled) return null;
    return queryClient.fetchQuery({
      ...queryOptions,
      staleTime: 0,
    });
  };

  const markDailyQuotaExhausted = () => {
    queryClient.setQueryData(queryOptions.queryKey, (current = DEFAULT_QUOTA) => ({
      ...current,
      used: current.limit,
      remaining: 0,
    }));
  };

  return {
    dailyQuota,
    applyQuotaPayload,
    refreshDailyQuota,
    markDailyQuotaExhausted,
  };
}
