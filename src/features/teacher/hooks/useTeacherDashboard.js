import { useState, useCallback } from 'react';
import { useAuthStore } from '../../../app/store/authStore';
import { useUiStore } from '../../../app/store/uiStore';
import { apiService } from '../../../services/api';
import { normalizeTeacherDashboard } from '../../../services/normalizers';

export function useTeacherDashboard() {
  const getTeacherUserId = useAuthStore(state => state.getTeacherUserId);
  const courseId = useUiStore(state => state.courseId);
  const classId = useUiStore(state => state.classId);

  const [teacherStudents, setTeacherStudents] = useState([]);
  const [teacherTopicHeatmap, setTeacherTopicHeatmap] = useState([]);
  const [teacherDashboardLoading, setTeacherDashboardLoading] = useState(false);

  const loadTeacherDashboard = useCallback(async () => {
    setTeacherDashboardLoading(true);
    try {
      const data = await apiService.getTeacherDashboard(getTeacherUserId(), courseId, classId);
      const normalized = normalizeTeacherDashboard(data);
      setTeacherStudents(normalized.students || []);
      setTeacherTopicHeatmap(normalized.topicHeatmap || []);
    } catch (e) {
      console.warn('Failed to load teacher dashboard:', e);
      setTeacherStudents([]);
      setTeacherTopicHeatmap([]);
    } finally {
      setTeacherDashboardLoading(false);
    }
  }, [getTeacherUserId, courseId, classId]);

  return {
    teacherStudents,
    teacherTopicHeatmap,
    teacherDashboardLoading,
    loadTeacherDashboard
  };
}
