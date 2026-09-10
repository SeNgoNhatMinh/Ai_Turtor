import { useEffect, useState } from 'react';
import { DAILY_COURSE_QUESTION_LIMIT, normalizeDailyQuota } from '../../../constants/sessionQuota';
import { aiTutorApi } from '../../../services/aiTutorApi';

const createDefaultQuota = () => ({
  used: 0,
  remaining: DAILY_COURSE_QUESTION_LIMIT,
  limit: DAILY_COURSE_QUESTION_LIMIT,
});

const hasQuotaPayload = (payload) => (
  payload != null
  && (
    payload.dailyQuestionUsed != null
    || payload.used != null
    || payload.dailyQuestionRemaining != null
    || payload.remaining != null
  )
);

export function useDailyQuestionQuota({ userId, studentId, courseId }) {
  const resolvedUserId = userId || studentId;
  const quotaScope = resolvedUserId && courseId ? `${resolvedUserId}:${courseId}` : '';
  const [quotaState, setQuotaState] = useState(() => ({
    scope: '',
    value: createDefaultQuota(),
  }));
  const dailyQuota = quotaState.scope === quotaScope
    ? quotaState.value
    : createDefaultQuota();

  const setDailyQuota = (valueOrUpdater) => {
    setQuotaState((current) => {
      const currentValue = current.scope === quotaScope ? current.value : createDefaultQuota();
      const nextValue = typeof valueOrUpdater === 'function'
        ? valueOrUpdater(currentValue)
        : valueOrUpdater;
      return { scope: quotaScope, value: nextValue };
    });
  };

  useEffect(() => {
    if (!resolvedUserId || !courseId) {
      return undefined;
    }

    let cancelled = false;
    aiTutorApi.getQuestionQuota(resolvedUserId, courseId, {
      skipUnauthorizedRedirect: true,
    }).then((data) => {
      if (!cancelled) {
        setQuotaState({
          scope: quotaScope,
          value: normalizeDailyQuota(data),
        });
      }
    }).catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [courseId, quotaScope, resolvedUserId]);

  const applyQuotaPayload = (payload) => {
    if (!hasQuotaPayload(payload)) return null;
    const nextQuota = normalizeDailyQuota(payload);
    setDailyQuota(nextQuota);
    return nextQuota;
  };

  const refreshDailyQuota = async () => {
    if (!resolvedUserId || !courseId) return null;
    const nextQuota = normalizeDailyQuota(await aiTutorApi.getQuestionQuota(
      resolvedUserId,
      courseId,
      { skipUnauthorizedRedirect: true },
    ));
    setDailyQuota(nextQuota);
    return nextQuota;
  };

  const markDailyQuotaExhausted = () => {
    setDailyQuota((current) => ({
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
