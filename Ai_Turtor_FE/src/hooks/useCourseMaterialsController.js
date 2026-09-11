import { useCallback, useEffect, useRef, useState } from 'react';
import { assignmentApi } from '../services/assignmentApi';
import { materialsApi } from '../services/materialsApi';
import { getUserFacingError } from '../services/apiClient';
import { asArray, normalizeCourseMaterial } from '../services/normalizers';
import { useRealtimeEvent, useRealtimeReconnect } from '../features/realtime/realtimeContext';
import { eventMatchesCourse, REALTIME_EVENT_TYPES } from '../features/realtime/realtimeEvents';

const INITIAL_MATERIALS_PAGE = Object.freeze({
  page: 0,
  pageSize: 8,
  totalElements: 0,
  totalPages: 1,
  query: '',
  serverPaged: false,
});

function getMaterialStatusFromEvent(event) {
  if (event.type === 'MATERIAL_INDEXING_FAILED') return 'INDEXING_FAILED';
  if (event.type === 'MATERIAL_INDEXED') return 'INDEXED';
  if (event.type === 'MATERIAL_INDEXING') return 'INDEXING';
  return event.status || 'PROCESSING';
}

export function useCourseMaterialsController({
  courseId,
  classId,
  studentId,
  teacherId,
  triggerToast,
  skipUnauthorizedRedirect = false,
}) {
  const [courseMaterials, setCourseMaterials] = useState([]);
  const [isMaterialsLoading, setIsMaterialsLoading] = useState(false);
  const [materialsError, setMaterialsError] = useState('');
  const [materialsPage, setMaterialsPage] = useState(INITIAL_MATERIALS_PAGE);
  const [uploadProgress, setUploadProgress] = useState(null);
  const [uploadProgressText, setUploadProgressText] = useState('');
  const materialsRequestRef = useRef(null);
  const optimisticMaterialsRef = useRef(new Map());
  const realtimeRefreshRef = useRef(null);
  const materialsPageRef = useRef(INITIAL_MATERIALS_PAGE);

  const updateMaterialsPage = useCallback((next) => {
    const value = typeof next === 'function' ? next(materialsPageRef.current) : next;
    materialsPageRef.current = value;
    setMaterialsPage(value);
  }, []);

  useEffect(() => () => {
    materialsRequestRef.current?.abort();
    window.clearTimeout(realtimeRefreshRef.current);
  }, []);

  const loadCourseMaterials = useCallback(async (requestPage = {}) => {
    materialsRequestRef.current?.abort();
    if (!courseId || (studentId && !classId)) {
      setCourseMaterials([]);
      updateMaterialsPage(INITIAL_MATERIALS_PAGE);
      setMaterialsError('');
      setIsMaterialsLoading(false);
      return;
    }
    const controller = new AbortController();
    materialsRequestRef.current = controller;
    setIsMaterialsLoading(true);
    setMaterialsError('');
    try {
      const currentPage = materialsPageRef.current;
      const requestedPage = Number.isInteger(requestPage?.page) ? requestPage.page : currentPage.page;
      const requestedPageSize = Number.isInteger(requestPage?.pageSize) ? requestPage.pageSize : currentPage.pageSize;
      const requestedQuery = typeof requestPage?.query === 'string' ? requestPage.query : currentPage.query;
      const options = {
        signal: controller.signal,
        force: true,
        skipUnauthorizedRedirect,
        ...(studentId ? {
          page: requestedPage,
          size: requestedPageSize,
          query: requestedQuery,
        } : {}),
      };
      const data = studentId
        ? await materialsApi.getStudentClassMaterials(studentId, courseId, classId, options)
        : await materialsApi.getCourseMaterials(courseId, classId, options);
      if (!controller.signal.aborted) {
        const items = asArray(data, 'materials', 'content')
          .map(normalizeCourseMaterial)
          .filter((item) => !studentId || (
            String(item.classId || '').toLowerCase() === String(classId).toLowerCase()
            && String(item.materialScope || '').toUpperCase() === 'CLASS_SECTION'
            && String(item.uploadedByRole || '').toUpperCase() === 'TEACHER'
          ));
        const canonicalIds = new Set(items.map((item) => item.id).filter(Boolean));
        canonicalIds.forEach((id) => optimisticMaterialsRef.current.delete(id));
        const optimisticItems = [...optimisticMaterialsRef.current.values()]
          .filter((item) => !canonicalIds.has(item.id));
        const mergedItems = [...optimisticItems, ...items];
        setCourseMaterials(mergedItems);
        updateMaterialsPage({
          page: Number(data?.page ?? requestedPage),
          pageSize: Number(data?.size ?? requestedPageSize),
          totalElements: Number(data?.totalElements ?? data?.count ?? mergedItems.length),
          totalPages: Number(data?.totalPages ?? 1),
          query: requestedQuery,
          serverPaged: Boolean(studentId && data?.page != null && data?.size != null),
        });
        return mergedItems;
      }
    } catch (error) {
      if (controller.signal.aborted) return;
      console.warn('Failed to load course materials:', error);
      if (studentId) setCourseMaterials([]);
      setMaterialsError(getUserFacingError(error, 'Không thể tải tài liệu của giảng viên.'));
    } finally {
      if (materialsRequestRef.current === controller) {
        materialsRequestRef.current = null;
        setIsMaterialsLoading(false);
      }
    }
  }, [classId, courseId, skipUnauthorizedRedirect, studentId, updateMaterialsPage]);

  const changeMaterialsPage = useCallback((page, pageSize) => {
    loadCourseMaterials({ page, pageSize });
  }, [loadCourseMaterials]);

  const searchMaterials = useCallback((query) => {
    loadCourseMaterials({ page: 0, query });
  }, [loadCourseMaterials]);

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

  const handleDownloadMaterial = async (materialId, title) => {
    if (!courseId) {
      triggerToast('Hãy chọn môn học trước khi tải học liệu xuống.');
      return;
    }
    triggerToast('Đang tải học liệu...');
    try {
      const blob = studentId
        ? await materialsApi.downloadStudentClassMaterialPdf(studentId, courseId, classId, materialId)
        : await materialsApi.downloadMaterialPdf(courseId, materialId);
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
    isMaterialsLoading,
    materialsError,
    materialsPage,
    upsertCourseMaterial,
    setCourseMaterials,
    uploadProgress,
    uploadProgressText,
    loadCourseMaterials,
    changeMaterialsPage,
    searchMaterials,
    handleTeacherUploadMaterial,
    handleDownloadMaterial,
  };
}
