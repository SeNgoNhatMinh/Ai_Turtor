import { useState, useCallback } from 'react';
import { apiService } from '../services/api';
import { useUiStore } from '../app/store/uiStore';
import { getUserFacingError } from '../services/apiClient';

export function useMaterials() {
  const courseId = useUiStore(state => state.courseId);
  const triggerToast = useUiStore(state => state.setToastMessage);

  const [courseMaterials, setCourseMaterials] = useState([]);

  const loadCourseMaterials = useCallback(async () => {
    if (!courseId) return;
    try {
      const data = await apiService.getCourseMaterials(courseId);
      setCourseMaterials(Array.isArray(data) ? data : data?.content || []);
    } catch (e) {
      console.warn('Failed to load course materials:', e);
      setCourseMaterials([]);
    }
  }, [courseId]);

  const handleTeacherUploadMaterial = useCallback(async (title, classIdVal, file) => {
    try {
      await apiService.uploadCourseMaterial(courseId, title, classIdVal, file);
      triggerToast('Material uploaded.');
      loadCourseMaterials();
    } catch (error) {
      triggerToast(getUserFacingError(error, 'Upload failed.'));
    }
  }, [courseId, loadCourseMaterials, triggerToast]);

  const handleTeacherDeleteMaterial = useCallback(async (materialId) => {
    try {
      await apiService.deleteMaterial(materialId);
      triggerToast('Material deleted.');
      loadCourseMaterials();
    } catch (error) {
      triggerToast(getUserFacingError(error, 'Delete failed.'));
    }
  }, [loadCourseMaterials, triggerToast]);

  const handleTeacherReindexMaterial = useCallback(async (materialId) => {
    try {
      await apiService.reindexMaterial(materialId);
      triggerToast('Re-indexing requested.');
    } catch (error) {
      triggerToast(getUserFacingError(error, 'Re-index failed.'));
    }
  }, [triggerToast]);

  const handleDownloadMaterial = useCallback(async (materialId, title) => {
    try {
      await apiService.downloadMaterialFile(materialId, title);
    } catch (error) {
      triggerToast(getUserFacingError(error, 'Download failed.'));
    }
  }, [triggerToast]);

  return {
    courseMaterials,
    loadCourseMaterials,
    handleTeacherUploadMaterial,
    handleTeacherDeleteMaterial,
    handleTeacherReindexMaterial,
    handleDownloadMaterial
  };
}
