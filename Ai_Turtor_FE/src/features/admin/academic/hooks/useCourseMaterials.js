import { useCallback, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../../../../app/queryKeys';
import { API_BASE_URL, getUserFacingError } from '../../../../services/apiClient';
import { materialsApi } from '../../../../services/materialsApi';
import { confirmDanger } from '../../../../components/common/confirmDialog';
import { isMaterialIndexing, normalizeMaterialsResponse } from '../adminAcademicUtils';
import {
  useRealtimeConnectionState,
  useRealtimeEvent,
  useRealtimeReconnect,
} from '../../../realtime/realtimeContext';
import { eventMatchesCourse, REALTIME_EVENT_TYPES } from '../../../realtime/realtimeEvents';

const EMPTY_LIST = [];
const wait = (ms) => new Promise((resolve) => window.setTimeout(resolve, ms));

export function useCourseMaterials({
  triggerToast,
  currentUser,
  formMaterial,
  onCourseSyllabusUpdated,
}) {
  const queryClient = useQueryClient();
  const realtimeState = useRealtimeConnectionState();
  const [materialCourseId, setMaterialCourseId] = useState('');
  const [materialUploadBusy, setMaterialUploadBusy] = useState(false);
  const [materialFile, setMaterialFile] = useState(null);
  const [websiteImportOpen, setWebsiteImportOpen] = useState(false);
  const [reconciling, setReconciling] = useState(false);
  const queryKey = queryKeys.adminCourseMaterials(materialCourseId);

  const materialsQuery = useQuery({
    queryKey,
    queryFn: async ({ signal }) => normalizeMaterialsResponse(
      await materialsApi.getCourseMaterials(materialCourseId, '', { signal }),
    ),
    enabled: Boolean(materialCourseId),
    staleTime: 15_000,
    refetchInterval: (query) => (
      realtimeState !== 'CONNECTED' && query.state.data?.some(isMaterialIndexing) ? 5000 : false
    ),
  });
  const courseMaterials = materialCourseId ? materialsQuery.data || EMPTY_LIST : EMPTY_LIST;

  const loadCourseMaterials = useCallback(async (courseId = materialCourseId, options = {}) => {
    const normalizedCourseId = String(courseId || '').trim();
    if (!normalizedCourseId) return [];
    if (normalizedCourseId !== materialCourseId) {
      setMaterialCourseId(normalizedCourseId);
      return queryClient.getQueryData(queryKeys.adminCourseMaterials(normalizedCourseId)) || [];
    }
    const result = await materialsQuery.refetch();
    if (result.error && !options.suppressError) {
      triggerToast(getUserFacingError(result.error, 'Không thể tải học liệu môn học.'));
    }
    return result.data || [];
  }, [materialCourseId, materialsQuery, queryClient, triggerToast]);

  useRealtimeEvent(REALTIME_EVENT_TYPES.material, (event) => {
    if (!materialCourseId || !eventMatchesCourse(event, materialCourseId)) return;
    queryClient.invalidateQueries({ queryKey, exact: true });
  });

  useRealtimeReconnect(() => {
    if (materialCourseId) queryClient.invalidateQueries({ queryKey, exact: true });
  });

  const refreshCourseMaterialsWithRetry = async (courseId, previousCount = 0, expectedTitle = '') => {
    const delays = [0, 1200, 2500, 4500, 7000, 10000];
    const normalizedTitle = String(expectedTitle || '').trim().toLowerCase();
    const targetKey = queryKeys.adminCourseMaterials(courseId);
    setReconciling(true);
    try {
      for (const delay of delays) {
        if (delay) await wait(delay);
        try {
          const items = normalizeMaterialsResponse(
            await materialsApi.getCourseMaterials(courseId, '', { force: true }),
          );
          queryClient.setQueryData(targetKey, items);
          const hasExpectedTitle = normalizedTitle && items.some(
            (item) => String(item?.title || '').trim().toLowerCase() === normalizedTitle,
          );
          if (items.length > previousCount || hasExpectedTitle) return true;
        } catch (error) {
          if (delay === delays[delays.length - 1]) {
            triggerToast(getUserFacingError(error, 'Không thể cập nhật danh sách học liệu.'));
          }
        }
      }
      return false;
    } finally {
      setReconciling(false);
    }
  };

  const handleCourseChange = useCallback((courseId) => {
    setMaterialCourseId(courseId || '');
  }, []);

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
    formData.append('syllabusDescription', values.syllabusDescription);
    setMaterialUploadBusy(true);
    const releaseUploadButton = () => window.setTimeout(() => setMaterialUploadBusy(false), 2500);
    const previousCount = courseMaterials.length;
    try {
      await materialsApi.uploadMaterial(materialCourseId, formData);
      const appeared = await refreshCourseMaterialsWithRetry(materialCourseId, previousCount, values.title);
      formMaterial.resetFields(['title']);
      setMaterialFile(null);
      await onCourseSyllabusUpdated?.();
      triggerToast(appeared ? 'Đã tải học liệu dùng chung.' : 'Backend đã nhận tệp. Học liệu sẽ xuất hiện sau khi lập chỉ mục.');
    } catch (error) {
      triggerToast('Backend đang xử lý tệp. Hệ thống đang kiểm tra danh sách học liệu...');
      const appeared = await refreshCourseMaterialsWithRetry(materialCourseId, previousCount, values.title);
      if (appeared) {
        formMaterial.resetFields(['title']);
        setMaterialFile(null);
        await onCourseSyllabusUpdated?.();
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
    await onCourseSyllabusUpdated?.();
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
      const downloadCourseId = record?.courseId || materialCourseId;
      if (!downloadCourseId) {
        triggerToast('Không xác định được môn học của tài liệu. Hãy làm mới danh sách và thử lại.');
        return;
      }
      const safeTitle = String(title || 'material').replace(/[<>:"/\\|?*]/g, '_').trim();
      const fileName = `${safeTitle || 'material'}.pdf`;
      triggerToast('Đang chuẩn bị tệp PDF...');
      const ticketResponse = await materialsApi.createMaterialDownloadTicket(downloadCourseId, materialId);
      const ticket = String(ticketResponse?.ticket || '').trim();
      if (!ticket) throw new Error('Máy chủ không tạo được vé tải học liệu.');
      const anchor = document.createElement('a');
      anchor.href = `${API_BASE_URL}/material-downloads/${encodeURIComponent(ticket)}`;
      anchor.download = fileName;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      triggerToast('Đã bắt đầu tải tệp PDF.');
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
      await queryClient.invalidateQueries({ queryKey, exact: true });
      triggerToast('Đã yêu cầu lập chỉ mục lại học liệu.');
    } catch (error) {
      triggerToast(getUserFacingError(error, 'Không thể lập chỉ mục lại học liệu.'));
    }
  };

  const handleDeleteMaterial = async (materialId) => {
    if (!materialId) {
      triggerToast('Học liệu thiếu mã định danh. Hãy làm mới danh sách và thử lại.');
      return;
    }
    confirmDanger({
      title: 'Xóa học liệu môn học?',
      content: 'Học liệu dùng chung sẽ bị xóa khỏi kho tri thức AI của môn học.',
      okText: 'Xóa',
      onOk: async () => {
        try {
          await materialsApi.deleteMaterial(materialCourseId, materialId);
          await queryClient.invalidateQueries({ queryKey, exact: true });
          triggerToast('Đã xóa học liệu môn học.');
        } catch (error) {
          triggerToast(getUserFacingError(error, 'Không thể xóa học liệu môn học.'));
        }
      },
    });
  };

  return {
    materialCourseId,
    courseMaterials,
    materialsLoading: Boolean(materialCourseId)
      && (materialsQuery.isPending || materialsQuery.isFetching || reconciling),
    materialsError: materialsQuery.error
      ? getUserFacingError(materialsQuery.error, 'Không thể tải học liệu môn học.')
      : '',
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
