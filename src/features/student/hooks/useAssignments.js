import { useState, useCallback } from 'react';
import { useAuthStore } from '../../../app/store/authStore';
import { useUiStore } from '../../../app/store/uiStore';
import { apiService } from '../../../services/api';
import { getUserFacingError } from '../../../services/apiClient';

export function useAssignments() {
  const getStudentUserId = useAuthStore(state => state.getStudentUserId);
  const courseId = useUiStore(state => state.courseId);
  const classId = useUiStore(state => state.classId);
  const triggerToast = useUiStore(state => state.setToastMessage);

  const [assignments, setAssignments] = useState([]);
  const [selectedAssignment, setSelectedAssignment] = useState(null);

  const loadAssignments = useCallback(async () => {
    const studentId = getStudentUserId();
    if (!studentId || !courseId || !classId) return;
    try {
      const data = await apiService.getStudentAssignments(studentId, courseId, classId);
      setAssignments(Array.isArray(data) ? data : data?.content || []);
    } catch (error) {
      console.warn('Failed to load student assignments:', error);
      setAssignments([]);
    }
  }, [getStudentUserId, courseId, classId]);

  const submitAssignment = useCallback(async (assignmentId, file, note) => {
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('note', note || '');
      await apiService.submitAssignment(assignmentId, formData, getStudentUserId());
      triggerToast('Assignment submitted successfully!');
      loadAssignments();
    } catch (error) {
      triggerToast(getUserFacingError(error, 'Failed to submit assignment.'));
    }
  }, [getStudentUserId, loadAssignments, triggerToast]);

  const downloadAssignment = useCallback(async (assignmentId) => {
    try {
      await apiService.downloadAssignmentFile(assignmentId);
    } catch (error) {
      triggerToast(getUserFacingError(error, 'Failed to download assignment file.'));
    }
  }, [triggerToast]);

  return {
    assignments,
    selectedAssignment,
    setSelectedAssignment,
    loadAssignments,
    submitAssignment,
    downloadAssignment
  };
}
