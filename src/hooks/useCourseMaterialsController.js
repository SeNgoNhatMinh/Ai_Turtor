import { useState } from 'react';
import { assignmentApi } from '../services/assignmentApi';
import { materialsApi } from '../services/materialsApi';
import { getUserFacingError } from '../services/apiClient';
import { asArray, normalizeCourseMaterial } from '../services/normalizers';

export function useCourseMaterialsController({
  courseId,
  classId,
  teacherId,
  triggerToast,
}) {
  const [courseMaterials, setCourseMaterials] = useState([]);
  const [uploadProgress, setUploadProgress] = useState(null);
  const [uploadProgressText, setUploadProgressText] = useState('');

  const loadCourseMaterials = async () => {
    if (!courseId) {
      setCourseMaterials([]);
      return;
    }
    try {
      const data = await materialsApi.getCourseMaterials(courseId, classId);
      setCourseMaterials(asArray(data, 'materials', 'content').map(normalizeCourseMaterial));
    } catch (error) {
      console.warn('Failed to load course materials:', error);
      setCourseMaterials([]);
    }
  };

  const handleTeacherUploadMaterial = async (title, classIdVal, file) => {
    if (!courseId) {
      triggerToast('Please choose a course before uploading material.');
      return;
    }
    setUploadProgress(0);
    setUploadProgressText('Loading file...');

    let progress = 0;
    const interval = window.setInterval(() => {
      progress += 20;
      if (progress > 90) {
        window.clearInterval(interval);
      } else {
        setUploadProgress(progress);
        setUploadProgressText(`Processing upload: ${progress}%`);
      }
    }, 200);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('title', title);
    formData.append('teacherId', teacherId);
    if (classIdVal) formData.append('classId', classIdVal);

    try {
      if (title.toLowerCase().includes('assignment')) {
        await assignmentApi.uploadAssignment(courseId, classIdVal || classId, formData);
        triggerToast('New assignment published.');
      } else {
        await materialsApi.uploadMaterial(courseId, formData);
        triggerToast('Course material uploaded.');
        loadCourseMaterials();
      }

      setUploadProgress(100);
      setUploadProgressText('Upload completed.');
    } catch (error) {
      console.error('Error uploading teacher material:', error);
      triggerToast(getUserFacingError(error, 'Unable to upload material.'));
      setUploadProgressText('Upload failed.');
    } finally {
      window.clearInterval(interval);
    }
  };

  const handleTeacherDeleteMaterial = async (materialId) => {
    if (!courseId) {
      triggerToast('Please choose a course before deleting material.');
      return;
    }
    triggerToast('Deleting course material...');
    try {
      await materialsApi.deleteMaterial(courseId, materialId);
      triggerToast('Material deleted successfully.');
      loadCourseMaterials();
    } catch (error) {
      triggerToast(getUserFacingError(error, 'Failed to delete material.'));
    }
  };

  const handleTeacherReindexMaterial = async (materialId) => {
    if (!courseId) {
      triggerToast('Please choose a course before reindexing material.');
      return;
    }
    triggerToast('Reindexing course material...');
    try {
      await materialsApi.reindexMaterial(courseId, materialId);
      triggerToast('Material reindexing triggered.');
      loadCourseMaterials();
    } catch (error) {
      triggerToast(getUserFacingError(error, 'Failed to reindex material.'));
    }
  };

  const handleDownloadMaterial = async (materialId, title) => {
    if (!courseId) {
      triggerToast('Please choose a course before downloading material.');
      return;
    }
    triggerToast('Downloading material...');
    try {
      const blob = await materialsApi.downloadMaterialPdf(courseId, materialId);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${title || 'material'}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      triggerToast(getUserFacingError(error, 'Failed to download material.'));
    }
  };

  return {
    courseMaterials,
    setCourseMaterials,
    uploadProgress,
    uploadProgressText,
    loadCourseMaterials,
    handleTeacherUploadMaterial,
    handleTeacherDeleteMaterial,
    handleTeacherReindexMaterial,
    handleDownloadMaterial,
  };
}
