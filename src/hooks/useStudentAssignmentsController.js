import { useState } from 'react';
import { assignmentApi } from '../services/assignmentApi';
import { getUserFacingError } from '../services/apiClient';
import { asArray } from '../services/normalizers';

export function useStudentAssignmentsController({
  studentId,
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
      const assignList = asArray(assignmentData, 'content', 'assignments');
      const submissionList = asArray(submissionData, 'content', 'submissions');
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

  const handleStudentSubmit = async (assignmentId, file, note) => {
    triggerToast('Submitting assignment...');

    const formData = new FormData();
    formData.append('file', file);
    formData.append('note', note);

    try {
      await assignmentApi.submitAssignment(assignmentId, formData, studentId);
      triggerToast('Assignment submitted successfully.');
      await loadStudentAssignments();
      return true;
    } catch (error) {
      console.error('Error submitting assignment:', error);
      triggerToast(getUserFacingError(error, 'Unable to submit assignment.'));
      return false;
    }
  };

  const handleDownloadAssignment = async (assignmentId) => {
    triggerToast('Downloading assignment file...');
    try {
      const blob = await assignmentApi.downloadAssignmentFile(assignmentId);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `assignment-${assignmentId}.zip`;
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
