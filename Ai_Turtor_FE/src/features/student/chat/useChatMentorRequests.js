import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '../../../app/queryKeys';
import { normalizeEscalation } from '../../../services/normalizers';
import { supportChatApi } from '../../../services/supportChatApi';

const loadMentorRequests = async (userId, signal) => {
  const data = await supportChatApi.getEscalationHistory(userId, {
    signal,
    retries: 0,
    skipUnauthorizedRedirect: true,
  });
  return (Array.isArray(data) ? data : []).map(normalizeEscalation);
};

const filterRequestsByCourse = (requests, courseId) => {
  const normalizedCourseId = String(courseId || '').trim().toUpperCase();
  return requests.filter((request) => {
    const requestCourseId = String(request?.courseId || '').trim().toUpperCase();
    return !normalizedCourseId || !requestCourseId || requestCourseId === normalizedCourseId;
  });
};

export function useChatMentorRequests({ userId, courseId }) {
  const resolvedUserId = String(userId || '').trim();
  const mentorQuery = useQuery({
    queryKey: queryKeys.studentMentorRequests(resolvedUserId),
    queryFn: ({ signal }) => loadMentorRequests(resolvedUserId, signal),
    enabled: Boolean(resolvedUserId),
    staleTime: 30_000,
  });
  const mentorRequests = useMemo(
    () => filterRequestsByCourse(mentorQuery.data || [], courseId),
    [courseId, mentorQuery.data],
  );

  const refreshMentorRequests = async () => {
    if (!resolvedUserId) return [];
    const result = await mentorQuery.refetch();
    return filterRequestsByCourse(result.data || [], courseId);
  };

  return {
    mentorRequests,
    refreshMentorRequests,
  };
}
