import { useState } from 'react';
import { apiService } from '../services/api';
import { getUserFacingError } from '../services/apiClient';
import { asArray } from '../services/normalizers';

export function useStudentAssignmentsController({
  studentId,
  triggerToast,
}) {
  const [assignments, setAssignments] = useState([]);
  const [selectedAssignment, setSelectedAssignment] = useState(null);

  const loadStudentAssignments = async () => {
    try {
      const data = await apiService.getStudentAssignments(studentId);
      const assignList = asArray(data, 'content', 'assignments');
      setAssignments(assignList);
      setSelectedAssignment((current) => current || assignList[0] || null);
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
      await apiService.submitAssignment(assignmentId, formData, studentId);
      triggerToast('Assignment submitted successfully.');
      loadStudentAssignments();
    } catch (error) {
      console.error('Error submitting assignment:', error);
      triggerToast(getUserFacingError(error, 'Unable to submit assignment.'));
    }
  };

  const handleDownloadAssignment = async (assignmentId) => {
    triggerToast('Downloading assignment file...');
    try {
      const blob = await apiService.downloadAssignmentFile(assignmentId);
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

  return {
    assignments,
    selectedAssignment,
    setSelectedAssignment,
    loadStudentAssignments,
    handleStudentSubmit,
    handleDownloadAssignment,
  };
}
