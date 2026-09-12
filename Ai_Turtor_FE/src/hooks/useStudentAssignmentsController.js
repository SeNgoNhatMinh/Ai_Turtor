import { useCallback, useMemo, useState } from 'react';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../app/queryKeys';
import { assignmentApi } from '../services/assignmentApi';
import { getUserFacingError } from '../services/apiClient';
import {
  asArray,
  normalizeAssignment,
  normalizeAssignmentSubmission,
} from '../services/normalizers';
import { useRealtimeEvent, useRealtimeReconnect } from '../features/realtime/realtimeContext';
import { eventMatchesCourse, REALTIME_EVENT_TYPES } from '../features/realtime/realtimeEvents';

const INITIAL_ASSIGNMENTS_PAGE = Object.freeze({
  page: 0,
  pageSize: 8,
  query: '',
});
const EMPTY_LIST = [];

const getAssignmentId = (assignment) => assignment?.id || assignment?.assignmentId || '';

const loadStudentAssignmentsPage = async ({
  studentId,
  courseId,
  page,
  pageSize,
  query,
  signal,
  skipUnauthorizedRedirect,
}) => {
  const options = {
    signal,
    skipUnauthorizedRedirect,
    page,
    size: pageSize,
    query,
  };
  const assignmentData = await assignmentApi.getStudentAssignments(studentId, courseId, options);
  const assignments = asArray(assignmentData, 'content', 'assignments').map(normalizeAssignment);
  const assignmentIds = assignments.map(getAssignmentId).filter(Boolean);
  const submissionData = assignmentIds.length
    ? await assignmentApi.getStudentSubmissions(studentId, courseId, { ...options, assignmentIds })
    : [];
  const submissions = asArray(submissionData, 'content', 'submissions')
    .map(normalizeAssignmentSubmission);
  const submissionsByAssignment = new Map(submissions.map((submission) => [
    submission.assignmentId || submission.assignment?.id,
    submission,
  ]));
  const items = assignments.map((assignment) => {
    const submission = submissionsByAssignment.get(getAssignmentId(assignment));
    return submission
      ? { ...assignment, submission, status: submission.status || assignment.status, score: submission.score }
      : assignment;
  });

  return {
    items,
    pagination: {
      page: Number(assignmentData?.page ?? page),
      pageSize: Number(assignmentData?.size ?? pageSize),
      totalElements: Number(assignmentData?.totalElements ?? items.length),
      totalPages: Number(assignmentData?.totalPages ?? 1),
      query,
      serverPaged: assignmentData?.page != null && assignmentData?.size != null,
    },
  };
};

export function useStudentAssignmentsController({
  studentId,
  studentName = '',
  studentEmail = '',
  courseId = '',
  triggerToast,
  skipUnauthorizedRedirect = false,
}) {
  const queryClient = useQueryClient();
  const [pageRequest, setPageRequest] = useState(INITIAL_ASSIGNMENTS_PAGE);
  const [selectedAssignmentId, setSelectedAssignmentId] = useState('');
  const assignmentsQueryKey = useMemo(
    () => queryKeys.studentAssignments(studentId, courseId, pageRequest),
    [courseId, pageRequest, studentId],
  );
  const hasContext = Boolean(studentId);

  const assignmentsQuery = useQuery({
    queryKey: assignmentsQueryKey,
    queryFn: ({ signal }) => loadStudentAssignmentsPage({
      studentId,
      courseId,
      ...pageRequest,
      signal,
      skipUnauthorizedRedirect,
    }),
    enabled: hasContext,
    staleTime: 15_000,
    placeholderData: keepPreviousData,
    retry: 1,
  });

  const assignments = assignmentsQuery.data?.items || EMPTY_LIST;
  const assignmentsPage = assignmentsQuery.data?.pagination || {
    ...INITIAL_ASSIGNMENTS_PAGE,
    totalElements: 0,
    totalPages: 1,
    serverPaged: false,
  };
  const selectedAssignment = assignments.find(
    (assignment) => getAssignmentId(assignment) === selectedAssignmentId,
  ) || assignments[0] || null;

  const setSelectedAssignment = useCallback((assignment) => {
    setSelectedAssignmentId(getAssignmentId(assignment));
  }, []);

  const loadStudentAssignments = useCallback(async (requestPage = {}) => {
    if (!studentId) return [];
    const hasNewPageRequest = Number.isInteger(requestPage?.page)
      || Number.isInteger(requestPage?.pageSize)
      || typeof requestPage?.query === 'string';

    if (hasNewPageRequest) {
      setPageRequest((current) => ({
        page: Number.isInteger(requestPage.page) ? requestPage.page : current.page,
        pageSize: Number.isInteger(requestPage.pageSize) ? requestPage.pageSize : current.pageSize,
        query: typeof requestPage.query === 'string' ? requestPage.query : current.query,
      }));
      return assignmentsQuery.data?.items || [];
    }

    const result = await assignmentsQuery.refetch();
    return result.data?.items || [];
  }, [assignmentsQuery, studentId]);

  const changeAssignmentsPage = useCallback((page, pageSize) => {
    setPageRequest((current) => ({
      ...current,
      page: Number.isInteger(page) ? page : current.page,
      pageSize: Number.isInteger(pageSize) ? pageSize : current.pageSize,
    }));
  }, []);

  const searchAssignments = useCallback((query) => {
    setPageRequest((current) => ({ ...current, page: 0, query: String(query || '') }));
  }, []);

  useRealtimeEvent(REALTIME_EVENT_TYPES.studentAssignment, (event) => {
    if (eventMatchesCourse(event, courseId)) {
      queryClient.invalidateQueries({
        queryKey: ['student', 'assignments', studentId || 'anonymous', courseId || 'all'],
      });
    }
  });

  useRealtimeReconnect(() => {
    if (studentId) {
      queryClient.invalidateQueries({
        queryKey: ['student', 'assignments', studentId, courseId || 'all'],
      });
    }
  });

  const submitMutation = useMutation({
    mutationFn: ({ assignmentId, formData }) => assignmentApi.submitAssignment(
      assignmentId,
      formData,
      { studentId, studentName, studentEmail },
      { skipUnauthorizedRedirect },
    ),
    onSuccess: () => queryClient.invalidateQueries({
      queryKey: ['student', 'assignments', studentId || 'anonymous', courseId || 'all'],
    }),
  });

  const handleStudentSubmit = useCallback(async (assignmentId, file, note) => {
    triggerToast('Đang nộp bài...');
    const formData = new FormData();
    formData.append('file', file);
    formData.append('note', note);

    try {
      await submitMutation.mutateAsync({ assignmentId, formData });
      triggerToast('Đã nộp bài thành công.');
      return true;
    } catch (error) {
      console.error('Error submitting assignment:', error);
      triggerToast(getUserFacingError(error, 'Không thể nộp bài.'));
      return false;
    }
  }, [submitMutation, triggerToast]);

  const handleDownloadAssignment = useCallback(async (assignment) => {
    const assignmentId = typeof assignment === 'string' ? assignment : getAssignmentId(assignment);
    if (!assignmentId) {
      triggerToast('Bài tập này không có tệp để tải xuống.');
      return;
    }
    triggerToast('Đang tải tệp bài tập...');
    try {
      const blob = await assignmentApi.downloadAssignmentFile(assignmentId, { skipUnauthorizedRedirect });
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = assignment?.attachmentFileName || assignment?.fileName || `assignment-${assignmentId}`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading assignment:', error);
      triggerToast(getUserFacingError(error, 'Không thể tải tệp bài tập.'));
    }
  }, [skipUnauthorizedRedirect, triggerToast]);

  const handleDownloadSubmission = useCallback(async (submission) => {
    const submissionId = typeof submission === 'string'
      ? submission
      : submission?.id || submission?.submissionId;
    if (!submissionId) {
      triggerToast('Bài đã nộp không có tệp để tải xuống.');
      return;
    }
    try {
      const blob = await assignmentApi.downloadSubmissionFile(submissionId, { skipUnauthorizedRedirect });
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = submission?.submittedFileName || `submission-${submissionId}`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      triggerToast(getUserFacingError(error, 'Không thể tải tệp bạn đã nộp.'));
    }
  }, [skipUnauthorizedRedirect, triggerToast]);

  return {
    assignments,
    selectedAssignment,
    setSelectedAssignment,
    isAssignmentsLoading: assignmentsQuery.isPending || assignmentsQuery.isFetching,
    assignmentsError: assignmentsQuery.error
      ? getUserFacingError(assignmentsQuery.error, 'Không thể tải bài tập được giao.')
      : '',
    assignmentsPage,
    loadStudentAssignments,
    changeAssignmentsPage,
    searchAssignments,
    handleStudentSubmit,
    handleDownloadAssignment,
    handleDownloadSubmission,
  };
}
