import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../app/queryKeys';
import { assignmentApi } from '../services/assignmentApi';
import { materialsApi } from '../services/materialsApi';
import { getUserFacingError } from '../services/apiClient';
import { asArray, normalizeCourseMaterial } from '../services/normalizers';
import { useRealtimeEvent, useRealtimeReconnect } from '../features/realtime/realtimeContext';
import { eventMatchesCourse, REALTIME_EVENT_TYPES } from '../features/realtime/realtimeEvents';

const INITIAL_MATERIALS_PAGE = Object.freeze({
  page: 0,
  pageSize: 8,
  query: '',
});
const EMPTY_LIST = [];

function getMaterialStatusFromEvent(event) {
  if (event.type === 'MATERIAL_INDEXING_FAILED') return 'INDEXING_FAILED';
  if (event.type === 'MATERIAL_INDEXED') return 'INDEXED';
  if (event.type === 'MATERIAL_INDEXING') return 'INDEXING';
  return event.status || 'PROCESSING';
}

const loadMaterialsPage = async ({
  courseId,
  classId,
  studentId,
  pageRequest,
  signal,
  skipUnauthorizedRedirect,
  optimisticMaterials,
}) => {
  const options = {
    signal,
    skipUnauthorizedRedirect,
    ...(studentId ? {
      page: pageRequest.page,
      size: pageRequest.pageSize,
      query: pageRequest.query,
    } : {}),
  };
  const data = studentId
    ? await materialsApi.getStudentClassMaterials(studentId, courseId, classId, options)
    : await materialsApi.getCourseMaterials(courseId, classId, options);
  const canonicalItems = asArray(data, 'materials', 'content')
    .map(normalizeCourseMaterial)
    .filter((item) => !studentId || (
      String(item.classId || '').toLowerCase() === String(classId).toLowerCase()
      && String(item.materialScope || '').toUpperCase() === 'CLASS_SECTION'
      && String(item.uploadedByRole || '').toUpperCase() === 'TEACHER'
    ));
  const canonicalIds = new Set(canonicalItems.map((item) => item.id).filter(Boolean));
  canonicalIds.forEach((id) => optimisticMaterials.delete(id));
  const optimisticItems = [...optimisticMaterials.values()]
    .filter((item) => !canonicalIds.has(item.id));
  const items = [...optimisticItems, ...canonicalItems];

  return {
    items,
    pagination: {
      page: Number(data?.page ?? pageRequest.page),
      pageSize: Number(data?.size ?? pageRequest.pageSize),
      totalElements: Number(data?.totalElements ?? data?.count ?? items.length),
      totalPages: Number(data?.totalPages ?? 1),
      query: pageRequest.query,
      serverPaged: Boolean(studentId && data?.page != null && data?.size != null),
    },
  };
};

export function useCourseMaterialsController({
  courseId,
  classId,
  studentId,
  teacherId,
  triggerToast,
  skipUnauthorizedRedirect = false,
}) {
  const queryClient = useQueryClient();
  const [pageRequest, setPageRequest] = useState(INITIAL_MATERIALS_PAGE);
  const [uploadProgress, setUploadProgress] = useState(null);
  const [uploadProgressText, setUploadProgressText] = useState('');
  const optimisticMaterialsRef = useRef(new Map());
  const realtimeRefreshRef = useRef(null);
  const queryKey = useMemo(() => queryKeys.courseMaterials({
    courseId,
    classId,
    studentId,
    teacherId,
    filters: pageRequest,
  }), [classId, courseId, pageRequest, studentId, teacherId]);
  const hasContext = Boolean(courseId && (!studentId || classId));

  const materialsQuery = useQuery({
    queryKey,
    queryFn: ({ signal }) => loadMaterialsPage({
      courseId,
      classId,
      studentId,
      pageRequest,
      signal,
      skipUnauthorizedRedirect,
      optimisticMaterials: optimisticMaterialsRef.current,
    }),
    enabled: hasContext,
    staleTime: 15_000,
    placeholderData: keepPreviousData,
    retry: 1,
  });
  const refetchMaterials = materialsQuery.refetch;
  const courseMaterials = materialsQuery.data?.items || EMPTY_LIST;
  const materialsPage = useMemo(() => materialsQuery.data?.pagination || ({
    ...pageRequest,
    totalElements: 0,
    totalPages: 1,
    serverPaged: false,
  }), [materialsQuery.data?.pagination, pageRequest]);

  useEffect(() => () => {
    window.clearTimeout(realtimeRefreshRef.current);
  }, []);

  const setCourseMaterials = useCallback((updater) => {
    queryClient.setQueryData(queryKey, (current = {
      items: [],
      pagination: materialsPage,
    }) => ({
      ...current,
      items: typeof updater === 'function' ? updater(current.items || []) : updater,
    }));
  }, [materialsPage, queryClient, queryKey]);

  const loadCourseMaterials = useCallback(async (requestPage = {}) => {
    if (!hasContext) return [];
    const hasNewPageRequest = Number.isInteger(requestPage?.page)
      || Number.isInteger(requestPage?.pageSize)
      || typeof requestPage?.query === 'string';

    if (hasNewPageRequest) {
      setPageRequest((current) => ({
        page: Number.isInteger(requestPage.page) ? requestPage.page : current.page,
        pageSize: Number.isInteger(requestPage.pageSize) ? requestPage.pageSize : current.pageSize,
        query: typeof requestPage.query === 'string'
          ? requestPage.query.trim()
          : current.query,
      }));
      return materialsQuery.data?.items || [];
    }

    const result = await refetchMaterials();
    return result.data?.items || [];
  }, [hasContext, materialsQuery.data?.items, refetchMaterials]);

  const changeMaterialsPage = useCallback((page, pageSize) => {
    setPageRequest((current) => ({
      ...current,
      page: Number.isInteger(page) ? page : current.page,
      pageSize: Number.isInteger(pageSize) ? pageSize : current.pageSize,
    }));
  }, []);

  const searchMaterials = useCallback((query) => {
    setPageRequest((current) => ({
      ...current,
      page: 0,
      query: String(query || '').trim(),
    }));
  }, []);

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
    realtimeRefreshRef.current = window.setTimeout(() => {
      queryClient.invalidateQueries({
        queryKey: ['materials', courseId || 'none'],
      });
    }, 300);
  });

  useRealtimeReconnect(() => {
    if (courseId) {
      queryClient.invalidateQueries({
        queryKey: ['materials', courseId],
      });
    }
  });

  const upsertCourseMaterial = useCallback((material) => {
    const normalized = normalizeCourseMaterial(material);
    if (!normalized.id) return;
    optimisticMaterialsRef.current.set(normalized.id, normalized);
    setCourseMaterials((current) => [
      normalized,
      ...current.filter((item) => item.id !== normalized.id),
    ]);
  }, [setCourseMaterials]);

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
        await queryClient.invalidateQueries({ queryKey: ['materials', courseId] });
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
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `${title || 'material'}.pdf`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      triggerToast(getUserFacingError(error, 'Không thể tải học liệu.'));
    }
  };

  return {
    courseMaterials,
    isMaterialsLoading: materialsQuery.isPending || materialsQuery.isFetching,
    materialsError: materialsQuery.error
      ? getUserFacingError(materialsQuery.error, 'Không thể tải tài liệu của giảng viên.')
      : '',
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
