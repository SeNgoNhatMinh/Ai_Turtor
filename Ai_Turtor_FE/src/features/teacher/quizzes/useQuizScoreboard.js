import { useCallback, useEffect, useMemo, useState } from 'react';
import { quizApi } from '../../../services/quizApi';
import { getUserFacingError } from '../../../services/apiClient';
import { getQuizAssignmentId } from './quizAssignmentUtils';
import {
  buildQuizScoreboardRows,
  summarizeQuizScoreboard,
} from './quizScoreboardUtils';

async function fetchAllQuizAttempts(teacherId, filters) {
  let page = 0;
  const size = 100;
  let attempts = [];
  let totalPages = 1;

  while (page < totalPages) {
    const response = await quizApi.getTeacherQuizAttempts(teacherId, { ...filters, page, size });
    attempts = attempts.concat(response.attempts || []);
    totalPages = Math.max(1, Number(response.totalPages) || 1);
    page += 1;
  }

  return attempts;
}

export function useQuizScoreboard({
  teacherId,
  courseId,
  classId,
  teacherStudents,
  triggerToast,
}) {
  const [assignment, setAssignment] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [attempts, setAttempts] = useState([]);

  const openScoreboard = useCallback((nextAssignment) => {
    setAssignment(nextAssignment || null);
    setAttempts([]);
    setError('');
  }, []);

  const closeScoreboard = useCallback(() => {
    setAssignment(null);
    setAttempts([]);
    setError('');
  }, []);

  useEffect(() => {
    if (!assignment || !teacherId) return undefined;

    let cancelled = false;
    const assignmentId = getQuizAssignmentId(assignment);

    (async () => {
      setLoading(true);
      setError('');
      try {
        const loadedAttempts = await fetchAllQuizAttempts(teacherId, {
          assignmentId,
          courseId: assignment.courseId || courseId,
          classId: assignment.classId || classId,
        });
        if (!cancelled) setAttempts(loadedAttempts);
      } catch (loadError) {
        if (!cancelled) {
          const message = getUserFacingError(loadError, 'Không thể tải bảng điểm quiz.');
          setError(message);
          setAttempts([]);
          triggerToast?.(message);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [assignment, classId, courseId, teacherId, triggerToast]);

  const rows = useMemo(
    () => buildQuizScoreboardRows(assignment, attempts, teacherStudents),
    [assignment, attempts, teacherStudents],
  );

  const summary = useMemo(() => summarizeQuizScoreboard(rows), [rows]);

  return {
    assignment,
    openScoreboard,
    closeScoreboard,
    loading,
    error,
    rows,
    summary,
    open: Boolean(assignment),
  };
}
