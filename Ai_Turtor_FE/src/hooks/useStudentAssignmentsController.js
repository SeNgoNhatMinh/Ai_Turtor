import { useCallback, useEffect, useRef, useState } from 'react';
import { assignmentApi } from '../services/assignmentApi';
import { getUserFacingError } from '../services/apiClient';
import {
  asArray,
  normalizeAssignment,
  normalizeAssignmentSubmission,
} from '../services/normalizers';
import { useRealtimeEvent, useRealtimeReconnect } from '../features/realtime/realtimeContext';
import { eventMatchesCourse, REALTIME_EVENT_TYPES } from '../features/realtime/realtimeEvents';

export function useStudentAssignmentsController({
  studentId,
  studentName = '',
  studentEmail = '',
  courseId = '',
  triggerToast,
  skipUnauthorizedRedirect = false,
}) {
  const [assignments, setAssignments] = useState([]);
  const [selectedAssignment, setSelectedAssignment] = useState(null);
  const [isAssignmentsLoading, setIsAssignmentsLoading] = useState(false);
  const [assignmentsError, setAssignmentsError] = useState('');
  const assignmentsRequestRef = useRef(null);

  useEffect(() => () => assignmentsRequestRef.current?.abort(), []);

  const loadStudentAssignments = useCallback(async () => {
    assignmentsRequestRef.current?.abort();
    if (!studentId) {
      setAssignments([]);
      setSelectedAssignment(null);
      setAssignmentsError('');
      setIsAssignmentsLoading(false);
      return;
    }
    const controller = new AbortController();
    assignmentsRequestRef.current = controller;
    setIsAssignmentsLoading(true);
    setAssignmentsError('');
    try {
      const options = {
        signal: controller.signal,
        skipUnauthorizedRedirect,
      };
      const [assignmentData, submissionData] = await Promise.all([
        assignmentApi.getStudentAssignments(studentId, courseId, options),
        assignmentApi.getStudentSubmissions(studentId, courseId, options),
      ]);
      if (controller.signal.aborted) return;
      const assignList = asArray(assignmentData, 'content', 'assignments').map(normalizeAssignment);
      const submissionList = asArray(submissionData, 'content', 'submissions').map(normalizeAssignmentSubmission);
      const submissionsByAssignment = new Map(submissionList.map((submission) => [
        submission.assignmentId || submission.assignment?.id,
        submission,
      ]));
      const merged = assignList.map((assignment) => {
        const assignmentId = assignment.id || assignment.assignmentId;
        const submission = submissionsByAssignment.get(assignmentId);
        return submission
          ? { ...assignment, submission, status: submission.status || assignment.status, score: submission.score }
          : assignment;
      });
      setAssignments(merged);
      setSelectedAssignment((current) => (
        merged.find((assignment) => (assignment.id || assignment.assignmentId) === (current?.id || current?.assignmentId))
        || merged[0]
        || null
      ));
    } catch (error) {
      if (controller.signal.aborted) return;
      console.warn('Failed to load student assignments:', error);
      setAssignments([]);
      setSelectedAssignment(null);
      setAssignmentsError(getUserFacingError(error, 'Không thể tải bài tập được giao.'));
    } finally {
      if (assignmentsRequestRef.current === controller) {
        assignmentsRequestRef.current = null;
        setIsAssignmentsLoading(false);
      }
    }
  }, [courseId, skipUnauthorizedRedirect, studentId]);

  useRealtimeEvent(REALTIME_EVENT_TYPES.studentAssignment, (event) => {
    if (eventMatchesCourse(event, courseId)) loadStudentAssignments();
  });

  useRealtimeReconnect(() => {
    if (studentId) loadStudentAssignments();
  });

  const handleStudentSubmit = async (assignmentId, file, note) => {
    triggerToast('Đang nộp bài...');

    const formData = new FormData();
    formData.append('file', file);
    formData.append('note', note);

    try {
      await assignmentApi.submitAssignment(assignmentId, formData, {
        studentId,
        studentName,
        studentEmail,
      }, { skipUnauthorizedRedirect });
      triggerToast('Đã nộp bài thành công.');
      await loadStudentAssignments();
      return true;
    } catch (error) {
      console.error('Error submitting assignment:', error);
      triggerToast(getUserFacingError(error, 'Không thể nộp bài.'));
      return false;
    }
  };

  const handleDownloadAssignment = async (assignment) => {
    const assignmentId = typeof assignment === 'string'
      ? assignment
      : assignment?.id || assignment?.assignmentId;
    if (!assignmentId) {
      triggerToast('Bài tập này không có tệp để tải xuống.');
      return;
    }
    triggerToast('Đang tải tệp bài tập...');
    try {
      const blob = await assignmentApi.downloadAssignmentFile(assignmentId, { skipUnauthorizedRedirect });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = assignment?.attachmentFileName || assignment?.fileName || `assignment-${assignmentId}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading assignment:', error);
      triggerToast(getUserFacingError(error, 'Không thể tải tệp bài tập.'));
    }
  };

  const handleDownloadSubmission = async (submission) => {
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
  };

  return {
    assignments,
    selectedAssignment,
    setSelectedAssignment,
    isAssignmentsLoading,
    assignmentsError,
    loadStudentAssignments,
    handleStudentSubmit,
    handleDownloadAssignment,
    handleDownloadSubmission,
  };
}
