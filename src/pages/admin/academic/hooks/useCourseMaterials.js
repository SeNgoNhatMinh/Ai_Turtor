import { useEffect, useState } from 'react';
import { getUserFacingError } from '../../../../services/apiClient';
import { materialsApi } from '../../../../services/materialsApi';
import { confirmDanger } from '../../../../components/common/confirmDialog';
import { isMaterialIndexing, normalizeMaterialsResponse } from '../adminAcademicUtils';

const wait = (ms) => new Promise((resolve) => window.setTimeout(resolve, ms));

export function useCourseMaterials({ triggerToast, currentUser, formMaterial }) {
  const [materialCourseId, setMaterialCourseId] = useState('');
  const [courseMaterials, setCourseMaterials] = useState([]);
  const [materialsLoading, setMaterialsLoading] = useState(false);
  const [materialUploadBusy, setMaterialUploadBusy] = useState(false);
  const [materialFile, setMaterialFile] = useState(null);
  const [websiteImportOpen, setWebsiteImportOpen] = useState(false);

  useEffect(() => {
    if (!materialCourseId || !courseMaterials.some(isMaterialIndexing)) {
      return undefined;
    }

    let cancelled = false;
    const pollMaterials = async () => {
      try {
        const data = await materialsApi.getCourseMaterials(materialCourseId);
        if (!cancelled) {
          setCourseMaterials(normalizeMaterialsResponse(data));
        }
      } catch {
        // Keep polling quiet. Manual Reload still surfaces errors.
      }
    };

    const intervalId = window.setInterval(pollMaterials, 2500);
    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [materialCourseId, courseMaterials]);

  const loadCourseMaterials = async (courseId = materialCourseId, options = {}) => {
    const { silent = false, suppressError = false } = options;
    if (!courseId) {
      setCourseMaterials([]);
      return;
    }
    if (!silent) setMaterialsLoading(true);
    try {
      const data = await materialsApi.getCourseMaterials(courseId);
      setCourseMaterials(normalizeMaterialsResponse(data));
    } catch (error) {
      if (!silent) setCourseMaterials([]);
      if (!suppressError) triggerToast(getUserFacingError(error, 'Unable to load course materials.'));
    } finally {
      if (!silent) setMaterialsLoading(false);
    }
  };

  const refreshCourseMaterialsWithRetry = async (courseId, previousCount = 0, expectedTitle = '') => {
    const delays = [0, 1200, 2500, 4500, 7000, 10000];
    const normalizedTitle = String(expectedTitle || '').trim().toLowerCase();
    setMaterialsLoading(true);
    try {
      for (const delay of delays) {
        if (delay) await wait(delay);
        try {
          const data = await materialsApi.getCourseMaterials(courseId);
          const items = normalizeMaterialsResponse(data);
          setCourseMaterials(items);
          const hasExpectedTitle = normalizedTitle && items.some((item) => String(item?.title || '').trim().toLowerCase() === normalizedTitle);
          if (items.length > previousCount || hasExpectedTitle) return true;
        } catch (error) {
          if (delay === delays[delays.length - 1]) {
            triggerToast(getUserFacingError(error, 'Unable to refresh course materials.'));
          }
        }
      }
      return false;
    } finally {
      setMaterialsLoading(false);
    }
  };

  const handleCourseChange = (courseId) => {
    setMaterialCourseId(courseId);
    loadCourseMaterials(courseId);
  };

  const handleUploadMaterial = async (values) => {
    if (materialUploadBusy) return;
    if (!materialCourseId) {
      triggerToast('Please choose a course first.');
      return;
    }
    if (!materialFile) {
      triggerToast('Please choose a material file first.');
      return;
    }
    const formData = new FormData();
    formData.append('file', materialFile);
    formData.append('title', values.title);
    formData.append('teacherId', currentUser?.userId || currentUser?.id || 'ADMIN');
    formData.append('uploaderRole', 'ADMIN');
    setMaterialUploadBusy(true);
    const releaseUploadButton = () => window.setTimeout(() => setMaterialUploadBusy(false), 2500);
    const previousCount = courseMaterials.length;
    try {
      await materialsApi.uploadMaterial(materialCourseId, formData);
      const appeared = await refreshCourseMaterialsWithRetry(materialCourseId, previousCount, values.title);
      formMaterial.resetFields();
      setMaterialFile(null);
      triggerToast(appeared ? 'Course-wide material uploaded.' : 'Upload accepted. Material may appear after indexing finishes.');
    } catch (error) {
      triggerToast('Upload is processing. Checking material list...');
      const appeared = await refreshCourseMaterialsWithRetry(materialCourseId, previousCount, values.title);
      if (appeared) {
        formMaterial.resetFields();
        setMaterialFile(null);
        triggerToast('Course-wide material uploaded.');
      } else {
        triggerToast(getUserFacingError(error, 'Unable to upload course material. Please try again.'));
      }
    } finally {
      releaseUploadButton();
    }
  };

  const handleWebsiteMaterialImported = async (expectedTitle) => {
    await refreshCourseMaterialsWithRetry(materialCourseId, courseMaterials.length, expectedTitle);
  };

  const handleDownloadMaterial = async (materialId, title, record) => {
    if (!materialId) {
      triggerToast('This material is missing an ID. Please reload materials and try again.');
      return;
    }
    if (record?.sourceType === 'HTML_URL') {
      triggerToast('This material was imported from a website and has no downloadable PDF file.');
      return;
    }
    try {
      const blob = await materialsApi.downloadMaterialPdf(materialCourseId, materialId);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${title || 'material'}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      triggerToast(getUserFacingError(error, 'Unable to download course material.'));
    }
  };

  const handleReindexMaterial = async (materialId) => {
    if (!materialId) {
      triggerToast('This material is missing an ID. Please reload materials and try again.');
      return;
    }
    try {
      await materialsApi.reindexMaterial(materialCourseId, materialId);
      triggerToast('Material reindexing triggered.');
    } catch (error) {
      triggerToast(getUserFacingError(error, 'Unable to reindex course material.'));
    }
  };

  const handleDeleteMaterial = async (materialId, anchorRect) => {
    if (!materialId) {
      triggerToast('This material is missing an ID. Please reload materials and try again.');
      return;
    }
    confirmDanger({
      title: 'Delete course material?',
      content: 'This removes the shared material from the course AI knowledge base.',
      okText: 'Delete',
      anchorRect,
      onOk: async () => {
        try {
          await materialsApi.deleteMaterial(materialCourseId, materialId);
          triggerToast('Course material deleted.');
          loadCourseMaterials(materialCourseId);
        } catch (error) {
          triggerToast(getUserFacingError(error, 'Unable to delete course material.'));
        }
      },
    });
  };

  return {
    materialCourseId,
    courseMaterials,
    materialsLoading,
    materialUploadBusy,
    materialFile,
    websiteImportOpen,
    setMaterialFile,
    setWebsiteImportOpen,
    loadCourseMaterials,
    handleCourseChange,
    handleUploadMaterial,
    handleWebsiteMaterialImported,
    handleDownloadMaterial,
    handleReindexMaterial,
    handleDeleteMaterial,
  };
}
