import { useCallback, useEffect, useState } from 'react';
import { assignmentApi } from '../../../services/assignmentApi';
import { quizApi } from '../../../services/quizApi';
import { supportChatApi } from '../../../services/supportChatApi';
import { asArray } from '../../../services/normalizers';
import { useRealtimeEvent, useRealtimeReconnect } from '../../realtime/realtimeContext';
import { eventMatchesCourse, REALTIME_EVENT_TYPES } from '../../realtime/realtimeEvents';
import { buildStudentNextSteps } from './studentNextStepUtils';

export function useStudentNextSteps({ studentId, courseId, classId }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!studentId || !courseId) {
      setItems([]);
      return;
    }
    setLoading(true);
    setError('');
    const results = await Promise.allSettled([
      assignmentApi.getStudentAssignments(studentId, courseId),
      assignmentApi.getStudentSubmissions(studentId, courseId),
      quizApi.getStudentQuizHistory(studentId, courseId, { force: true }),
      quizApi.getAssignedQuizzes(studentId, courseId, classId, { force: true }),
      supportChatApi.getEscalationHistory(studentId),
    ]);
    const value = (index) => results[index].status === 'fulfilled' ? results[index].value : null;
    if (results.every((result) => result.status === 'rejected')) {
      setItems([]);
      setError('Không thể tải các việc học tiếp theo. Các phần tiến độ khác vẫn có thể sử dụng.');
      setLoading(false);
      return;
    }
    setItems(buildStudentNextSteps({
      assignments: asArray(value(0), 'assignments', 'content'),
      submissions: asArray(value(1), 'submissions', 'content'),
      quizHistory: Array.isArray(value(2)) ? value(2) : [],
      assignedQuizzes: Array.isArray(value(3)) ? value(3) : [],
      escalations: Array.isArray(value(4)) ? value(4) : [],
    }));
    setLoading(false);
  }, [classId, courseId, studentId]);

  useEffect(() => {
    const timer = window.setTimeout(load, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  useRealtimeEvent(REALTIME_EVENT_TYPES.studentAssignment, (event) => {
    if (eventMatchesCourse(event, courseId)) load();
  });

  useRealtimeReconnect(load);

  return { items, loading, error, load };
}
