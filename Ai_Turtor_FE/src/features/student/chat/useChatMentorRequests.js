import { useCallback, useEffect, useRef, useState } from 'react';
import { normalizeEscalation } from '../../../services/normalizers';
import { supportChatApi } from '../../../services/supportChatApi';

export function useChatMentorRequests({ userId, courseId }) {
  const [mentorRequests, setMentorRequests] = useState([]);
  const requestVersionRef = useRef(0);

  const refreshMentorRequests = useCallback(async () => {
    const requestVersion = requestVersionRef.current + 1;
    requestVersionRef.current = requestVersion;

    if (!userId) {
      setMentorRequests([]);
      return [];
    }

    try {
      const data = await supportChatApi.getEscalationHistory(userId);
      const normalizedCourseId = String(courseId || '').trim().toUpperCase();
      const items = (Array.isArray(data) ? data : [])
        .map(normalizeEscalation)
        .filter((request) => {
          const requestCourseId = String(request?.courseId || '').trim().toUpperCase();
          return !normalizedCourseId || !requestCourseId || requestCourseId === normalizedCourseId;
        });

      if (requestVersion === requestVersionRef.current) setMentorRequests(items);
      return items;
    } catch {
      if (requestVersion === requestVersionRef.current) setMentorRequests([]);
      return [];
    }
  }, [courseId, userId]);

  useEffect(() => {
    const loadTimer = window.setTimeout(refreshMentorRequests, 0);
    return () => {
      window.clearTimeout(loadTimer);
      requestVersionRef.current += 1;
    };
  }, [refreshMentorRequests]);

  return {
    mentorRequests,
    refreshMentorRequests,
  };
}
