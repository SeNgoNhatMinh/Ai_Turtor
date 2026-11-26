import { useCallback, useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '../../../app/queryKeys';
import { quizApi } from '../../../services/quizApi';
import { getUserFacingError } from '../../../services/apiClient';
import { getQuizAssignmentId } from './quizAssignmentUtils';
import {
  buildQuizScoreboardRows,
  summarizeQuizScoreboard,
} from './quizScoreboardUtils';

const EMPTY_LIST = [];

async function fetchAllQuizAttempts(teacherId, filters, signal) {
  let page = 0;
  const size = 100;
  let attempts = [];
  let totalPages = 1;

  while (page < totalPages) {
    const response = await quizApi.getTeacherQuizAttempts(
      teacherId,
      { ...filters, page, size },
      { signal },
    );
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
  const assignmentId = getQuizAssignmentId(assignment);
  const assignmentCourseId = assignment?.courseId || courseId;
  const assignmentClassId = assignment?.classId || classId;
  const scoreboardQuery = useQuery({
    queryKey: queryKeys.teacherQuizScoreboard(
      teacherId,
      assignmentId,
      assignmentCourseId,
      assignmentClassId,
    ),
    queryFn: ({ signal }) => fetchAllQuizAttempts(teacherId, {
      assignmentId,
      courseId: assignmentCourseId,
      classId: assignmentClassId,
    }, signal),
    enabled: Boolean(assignment && teacherId && assignmentId),
    staleTime: 30_000,
  });
  const attempts = scoreboardQuery.data || EMPTY_LIST;
  const error = scoreboardQuery.error
    ? getUserFacingError(scoreboardQuery.error, 'Không thể tải bảng điểm quiz.')
    : '';

  const openScoreboard = useCallback((nextAssignment) => {
    setAssignment(nextAssignment || null);
  }, []);

  const closeScoreboard = useCallback(() => {
    setAssignment(null);
  }, []);

  useEffect(() => {
    if (error) triggerToast?.(error);
  }, [error, triggerToast]);

  const rows = useMemo(
    () => buildQuizScoreboardRows(assignment, attempts, teacherStudents),
    [assignment, attempts, teacherStudents],
  );

  const summary = useMemo(() => summarizeQuizScoreboard(rows), [rows]);

  return {
    assignment,
    openScoreboard,
    closeScoreboard,
    loading: Boolean(assignment) && (scoreboardQuery.isPending || scoreboardQuery.isFetching),
    error,
    rows,
    summary,
    open: Boolean(assignment),
  };
}
