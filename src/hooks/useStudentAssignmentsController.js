import { useState } from 'react';
import { assignmentApi } from '../services/assignmentApi';
import { getUserFacingError } from '../services/apiClient';
import {
  asArray,
  normalizeAssignment,
  normalizeAssignmentSubmission,
} from '../services/normalizers';
import { useRealtimeEvent } from '../features/realtime/realtimeContext';
import { eventMatchesCourse, REALTIME_EVENT_TYPES } from '../features/realtime/realtimeEvents';

export function useStudentAssignmentsController({
  studentId,
  studentName = '',
  studentEmail = '',
  courseId = '',
  triggerToast,
}) {
  const [assignments, setAssignments] = useState([]);
  const [selectedAssignment, setSelectedAssignment] = useState(null);

  const loadStudentAssignments = async () => {
    if (!studentId) {
      setAssignments([]);
      setSelectedAssignment(null);
      return;
    }
    try {
      const [assignmentData, submissionData] = await Promise.all([
        assignmentApi.getStudentAssignments(studentId, courseId),
        assignmentApi.getStudentSubmissions(studentId, courseId),
      ]);
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
      console.warn('Failed to load student assignments:', error);
      setAssignments([]);
    }
  };

  useRealtimeEvent(REALTIME_EVENT_TYPES.studentAssignment, (event) => {
    if (eventMatchesCourse(event, courseId)) loadStudentAssignments();
  });

  const handleStudentSubmit = async (assignmentId, file, note) => {
    triggerToast('Submitting assignment...');

    const formData = new FormData();
    formData.append('file', file);
    formData.append('note', note);

    try {
      await assignmentApi.submitAssignment(assignmentId, formData, {
        studentId,
        studentName,
        studentEmail,
      });
      triggerToast('Assignment submitted successfully.');
      await loadStudentAssignments();
      return true;
    } catch (error) {
      console.error('Error submitting assignment:', error);
      triggerToast(getUserFacingError(error, 'Unable to submit assignment.'));
      return false;
    }
  };

  const handleDownloadAssignment = async (assignment) => {
    const assignmentId = typeof assignment === 'string'
      ? assignment
      : assignment?.id || assignment?.assignmentId;
    if (!assignmentId) {
      triggerToast('This assignment does not have a downloadable file.');
      return;
    }
    triggerToast('Downloading assignment file...');
    try {
      const blob = await assignmentApi.downloadAssignmentFile(assignmentId);
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
      triggerToast(getUserFacingError(error, 'Unable to download assignment file.'));
    }
  };

  const handleDownloadSubmission = async (submission) => {
    const submissionId = typeof submission === 'string'
      ? submission
      : submission?.id || submission?.submissionId;
    if (!submissionId) {
      triggerToast('This submission does not have a downloadable file.');
      return;
    }
    try {
      const blob = await assignmentApi.downloadSubmissionFile(submissionId);
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = submission?.submittedFileName || `submission-${submissionId}`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      triggerToast(getUserFacingError(error, 'Unable to download your submitted file.'));
    }
  };

  return {
    assignments,
    selectedAssignment,
    setSelectedAssignment,
    loadStudentAssignments,
    handleStudentSubmit,
    handleDownloadAssignment,
    handleDownloadSubmission,
  };
}
