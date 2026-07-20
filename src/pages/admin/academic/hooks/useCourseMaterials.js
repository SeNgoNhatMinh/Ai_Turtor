import { useEffect, useState } from 'react';
import { getUserFacingError } from '../../../../services/apiClient';
import { materialsApi } from '../../../../services/materialsApi';
import { confirmDanger } from '../../../../components/common/confirmDialog';
import { isMaterialIndexing, normalizeMaterialsResponse } from '../adminAcademicUtils';
import { useRealtimeReconnect } from '../../../../features/realtime/realtimeContext';

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
        const data = await materialsApi.getCourseMaterials(materialCourseId, '', { force: true });
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
      const data = await materialsApi.getCourseMaterials(courseId, '', { force: true });
      setCourseMaterials(normalizeMaterialsResponse(data));
    } catch (error) {
      if (!suppressError) triggerToast(getUserFacingError(error, 'Không thể tải học liệu môn học.'));
    } finally {
      if (!silent) setMaterialsLoading(false);
    }
  };

  useRealtimeReconnect(() => {
    if (materialCourseId) loadCourseMaterials(materialCourseId, { silent: true, suppressError: true });
  });

  const refreshCourseMaterialsWithRetry = async (courseId, previousCount = 0, expectedTitle = '') => {
    const delays = [0, 1200, 2500, 4500, 7000, 10000];
    const normalizedTitle = String(expectedTitle || '').trim().toLowerCase();
    setMaterialsLoading(true);
    try {
      for (const delay of delays) {
        if (delay) await wait(delay);
        try {
          const data = await materialsApi.getCourseMaterials(courseId, '', { force: true });
          const items = normalizeMaterialsResponse(data);
          setCourseMaterials(items);
          const hasExpectedTitle = normalizedTitle && items.some((item) => String(item?.title || '').trim().toLowerCase() === normalizedTitle);
          if (items.length > previousCount || hasExpectedTitle) return true;
        } catch (error) {
          if (delay === delays[delays.length - 1]) {
            triggerToast(getUserFacingError(error, 'Không thể cập nhật danh sách học liệu.'));
          }
        }
      }
      return false;
    } finally {
      setMaterialsLoading(false);
    }
  };

  const handleCourseChange = (courseId) => {
    if (courseId !== materialCourseId) setCourseMaterials([]);
    setMaterialCourseId(courseId);
    loadCourseMaterials(courseId);
  };

  const handleUploadMaterial = async (values) => {
    if (materialUploadBusy) return;
    if (!materialCourseId) {
      triggerToast('Hãy chọn môn học trước.');
      return;
    }
    if (!materialFile) {
      triggerToast('Hãy chọn tệp học liệu trước.');
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
      triggerToast(appeared ? 'Đã tải học liệu dùng chung.' : 'Backend đã nhận tệp. Học liệu sẽ xuất hiện sau khi lập chỉ mục.');
    } catch (error) {
      triggerToast('Backend đang xử lý tệp. Hệ thống đang kiểm tra danh sách học liệu...');
      const appeared = await refreshCourseMaterialsWithRetry(materialCourseId, previousCount, values.title);
      if (appeared) {
        formMaterial.resetFields();
        setMaterialFile(null);
        triggerToast('Đã tải học liệu dùng chung.');
      } else {
        triggerToast(getUserFacingError(error, 'Không thể tải học liệu. Hãy thử lại.'));
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
      triggerToast('Học liệu thiếu mã định danh. Hãy làm mới danh sách và thử lại.');
      return;
    }
    if (record?.sourceType === 'HTML_URL') {
      triggerToast('Học liệu được import từ website nên không có tệp PDF để tải.');
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
      triggerToast(getUserFacingError(error, 'Không thể tải học liệu.'));
    }
  };

  const handleReindexMaterial = async (materialId) => {
    if (!materialId) {
      triggerToast('Học liệu thiếu mã định danh. Hãy làm mới danh sách và thử lại.');
      return;
    }
    try {
      await materialsApi.reindexMaterial(materialCourseId, materialId);
      triggerToast('Đã yêu cầu lập chỉ mục lại học liệu.');
    } catch (error) {
      triggerToast(getUserFacingError(error, 'Không thể lập chỉ mục lại học liệu.'));
    }
  };

  const handleDeleteMaterial = async (materialId, anchorRect) => {
    if (!materialId) {
      triggerToast('Học liệu thiếu mã định danh. Hãy làm mới danh sách và thử lại.');
      return;
    }
    confirmDanger({
      title: 'Xóa học liệu môn học?',
      content: 'Học liệu dùng chung sẽ bị xóa khỏi kho tri thức AI của môn học.',
      okText: 'Xóa',
      anchorRect,
      onOk: async () => {
        try {
          await materialsApi.deleteMaterial(materialCourseId, materialId);
          triggerToast('Đã xóa học liệu môn học.');
          loadCourseMaterials(materialCourseId);
        } catch (error) {
          triggerToast(getUserFacingError(error, 'Không thể xóa học liệu môn học.'));
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
