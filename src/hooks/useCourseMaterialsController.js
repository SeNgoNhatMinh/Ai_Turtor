import { useCallback, useEffect, useRef, useState } from 'react';
import { assignmentApi } from '../services/assignmentApi';
import { materialsApi } from '../services/materialsApi';
import { getUserFacingError } from '../services/apiClient';
import { asArray, normalizeCourseMaterial } from '../services/normalizers';
import { useRealtimeEvent, useRealtimeReconnect } from '../features/realtime/realtimeContext';
import { eventMatchesCourse, REALTIME_EVENT_TYPES } from '../features/realtime/realtimeEvents';

function getMaterialStatusFromEvent(event) {
  if (event.type === 'MATERIAL_INDEXING_FAILED') return 'INDEXING_FAILED';
  if (event.type === 'MATERIAL_INDEXED') return 'INDEXED';
  if (event.type === 'MATERIAL_INDEXING') return 'INDEXING';
  return event.status || 'PROCESSING';
}

export function useCourseMaterialsController({
  courseId,
  classId,
  teacherId,
  triggerToast,
}) {
  const [courseMaterials, setCourseMaterials] = useState([]);
  const [uploadProgress, setUploadProgress] = useState(null);
  const [uploadProgressText, setUploadProgressText] = useState('');
  const materialsRequestRef = useRef(null);
  const optimisticMaterialsRef = useRef(new Map());
  const realtimeRefreshRef = useRef(null);

  useEffect(() => () => {
    materialsRequestRef.current?.abort();
    window.clearTimeout(realtimeRefreshRef.current);
  }, []);

  const loadCourseMaterials = useCallback(async () => {
    if (!courseId) {
      setCourseMaterials([]);
      return;
    }
    materialsRequestRef.current?.abort();
    const controller = new AbortController();
    materialsRequestRef.current = controller;
    try {
      const data = await materialsApi.getCourseMaterials(courseId, classId, {
        signal: controller.signal,
        force: true,
      });
      if (!controller.signal.aborted) {
        const items = asArray(data, 'materials', 'content').map(normalizeCourseMaterial);
        const canonicalIds = new Set(items.map((item) => item.id).filter(Boolean));
        canonicalIds.forEach((id) => optimisticMaterialsRef.current.delete(id));
        const optimisticItems = [...optimisticMaterialsRef.current.values()]
          .filter((item) => !canonicalIds.has(item.id));
        const mergedItems = [...optimisticItems, ...items];
        setCourseMaterials(mergedItems);
        return mergedItems;
      }
    } catch (error) {
      if (controller.signal.aborted) return;
      console.warn('Failed to load course materials:', error);
    } finally {
      if (materialsRequestRef.current === controller) materialsRequestRef.current = null;
    }
  }, [classId, courseId]);

  useRealtimeEvent(REALTIME_EVENT_TYPES.material, (event) => {
    if (!eventMatchesCourse(event, courseId)) return;
    const materialId = String(event.entityId || '').trim();
    if (materialId) {
      const realtimeStatus = getMaterialStatusFromEvent(event);
      const patch = {
        indexingStatus: realtimeStatus,
        status: realtimeStatus,
        indexingError: event.data?.indexingError || event.data?.error || '',
      };
      const optimistic = optimisticMaterialsRef.current.get(materialId);
      if (optimistic) {
        optimisticMaterialsRef.current.set(materialId, { ...optimistic, ...patch });
      }
      setCourseMaterials((current) => current.map((item) => (
        item.id === materialId ? { ...item, ...patch } : item
      )));
    }
    window.clearTimeout(realtimeRefreshRef.current);
    realtimeRefreshRef.current = window.setTimeout(loadCourseMaterials, 300);
  });

  useRealtimeReconnect(() => {
    if (courseId) loadCourseMaterials();
  });

  const upsertCourseMaterial = useCallback((material) => {
    const normalized = normalizeCourseMaterial(material);
    if (!normalized.id) return;
    optimisticMaterialsRef.current.set(normalized.id, normalized);
    setCourseMaterials((current) => [
      normalized,
      ...current.filter((item) => item.id !== normalized.id),
    ]);
  }, []);

  const handleTeacherUploadMaterial = async (title, classIdVal, file) => {
    if (!courseId) {
      triggerToast('Hãy chọn môn học trước khi tải học liệu.');
      return;
    }
    setUploadProgress(0);
    setUploadProgressText('Đang đọc tệp...');

    let progress = 0;
    const interval = window.setInterval(() => {
      progress += 20;
      if (progress > 90) {
        window.clearInterval(interval);
      } else {
        setUploadProgress(progress);
        setUploadProgressText(`Đang xử lý tải lên: ${progress}%`);
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
        triggerToast('Đã xuất bản bài tập mới.');
      } else {
        await materialsApi.uploadMaterial(courseId, formData);
        triggerToast('Đã tải học liệu môn học.');
        loadCourseMaterials();
      }

      setUploadProgress(100);
      setUploadProgressText('Tải lên hoàn tất.');
    } catch (error) {
      console.error('Error uploading teacher material:', error);
      triggerToast(getUserFacingError(error, 'Không thể tải học liệu.'));
      setUploadProgressText('Tải lên thất bại.');
    } finally {
      window.clearInterval(interval);
    }
  };

  const handleTeacherDeleteMaterial = async (materialId) => {
    if (!courseId) {
      triggerToast('Hãy chọn môn học trước khi xóa học liệu.');
      return;
    }
    triggerToast('Đang xóa học liệu môn học...');
    try {
      await materialsApi.deleteMaterial(courseId, materialId);
      triggerToast('Đã xóa học liệu.');
      loadCourseMaterials();
    } catch (error) {
      triggerToast(getUserFacingError(error, 'Không thể xóa học liệu.'));
    }
  };

  const handleTeacherReindexMaterial = async (materialId) => {
    if (!courseId) {
      triggerToast('Hãy chọn môn học trước khi lập chỉ mục lại học liệu.');
      return;
    }
    triggerToast('Đang yêu cầu lập chỉ mục lại học liệu...');
    try {
      await materialsApi.reindexMaterial(courseId, materialId);
      triggerToast('Đã gửi yêu cầu lập chỉ mục lại.');
      loadCourseMaterials();
    } catch (error) {
      triggerToast(getUserFacingError(error, 'Không thể lập chỉ mục lại học liệu.'));
    }
  };

  const handleDownloadMaterial = async (materialId, title) => {
    if (!courseId) {
      triggerToast('Hãy chọn môn học trước khi tải học liệu xuống.');
      return;
    }
    triggerToast('Đang tải học liệu...');
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
      triggerToast(getUserFacingError(error, 'Không thể tải học liệu.'));
    }
  };

  return {
    courseMaterials,
    upsertCourseMaterial,
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
