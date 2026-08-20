import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getUserFacingError } from '../../../services/apiClient';
import { materialsApi } from '../../../services/materialsApi';
import { useMutationLock } from '../../../hooks/useMutationLock';
import { getRecordId } from '../shared/teacherUtils';
import { confirmDanger } from '../../../components/common/confirmDialog';
import { isTeacherOwnedMaterial } from './teacherMaterialPermissions';

const UPLOAD_COOLDOWN_MS = 2500;

export function useTeacherMaterialController({
  courseId,
  classId,
  teacherUserId,
  onReload,
  onAccepted,
  courseMaterials = [],
  triggerToast,
}) {
  const [file, setFile] = useState(null);
  const [title, setTitle] = useState('');
  const [uploading, setUploading] = useState(false);
  const [actionId, setActionId] = useState('');
  const [editing, setEditing] = useState(null);
  const [updating, setUpdating] = useState(false);
  const [pendingUpload, setPendingUpload] = useState(null);
  const cooldownTimerRef = useRef(null);
  const { runLocked } = useMutationLock();

  useEffect(() => () => window.clearTimeout(cooldownTimerRef.current), []);

  const resolvedPendingUpload = useMemo(() => {
    if (!pendingUpload?.id) return pendingUpload;
    const current = courseMaterials.find((material) => (
      String(material.id || material.materialId) === String(pendingUpload.id)
    ));
    if (!current) return pendingUpload;
    return {
      ...pendingUpload,
      ...current,
      status: current.indexingStatus || current.status || pendingUpload.status,
      indexingError: current.indexingError || current.error || '',
    };
  }, [courseMaterials, pendingUpload]);

  const upload = useCallback(async (event) => {
    event.preventDefault();
    if (!courseId || !classId) {
      triggerToast('Hãy chọn lớp giảng dạy ở trường phía trên.');
      return;
    }
    if (!file) {
      triggerToast('Hãy chọn tệp PDF để tải lên.');
      return;
    }
    if (!teacherUserId) {
      triggerToast('Không xác định được tài khoản giảng viên. Vui lòng đăng nhập lại.');
      return;
    }
    if (!String(file.name || '').toLowerCase().endsWith('.pdf')) {
      triggerToast('Học liệu môn học chỉ hỗ trợ tệp PDF.');
      return;
    }

    const uploadFingerprint = [courseId, classId, file.name, file.size].join(':');
    const pendingStatus = String(resolvedPendingUpload?.status || '').toUpperCase();
    if (
      resolvedPendingUpload?.fingerprint === uploadFingerprint
      && ['PENDING', 'QUEUED', 'PROCESSING', 'INDEXING'].includes(pendingStatus)
    ) {
      triggerToast('Tệp này đã được backend nhận và đang lập chỉ mục. Không cần tải lại.');
      return;
    }

    return runLocked('teacher:material:upload', async () => {
      window.clearTimeout(cooldownTimerRef.current);
      setUploading(true);

      const formData = new FormData();
      formData.append('file', file);
      formData.append('title', title || file.name);
      formData.append('uploaderRole', 'TEACHER');
      formData.append('teacherId', teacherUserId);
      formData.append('classId', classId);

      try {
        const receipt = await materialsApi.uploadMaterial(courseId, formData);
        const optimisticMaterial = {
          ...receipt,
          id: receipt.materialId || receipt.documentId,
          materialId: receipt.materialId || receipt.documentId,
          courseId,
          classId,
          title: title || file.name,
          fileName: file.name,
          sourceFileName: file.name,
          sourceType: receipt.sourceType || 'PDF',
          indexingStatus: receipt.indexingStatus || receipt.status || 'PROCESSING',
          status: receipt.indexingStatus || receipt.status || 'PROCESSING',
        };
        setPendingUpload({ ...optimisticMaterial, fingerprint: uploadFingerprint });
        onAccepted?.(optimisticMaterial);
        triggerToast('Backend đã nhận học liệu của lớp và đang lập chỉ mục trong nền.');
        await onReload?.();
      } catch (error) {
        triggerToast(getUserFacingError(error, 'Không thể tải học liệu của lớp.'));
      } finally {
        cooldownTimerRef.current = window.setTimeout(() => {
          setUploading(false);
        }, UPLOAD_COOLDOWN_MS);
      }
    });
  }, [
    classId,
    courseId,
    file,
    onAccepted,
    onReload,
    resolvedPendingUpload?.fingerprint,
    resolvedPendingUpload?.status,
    runLocked,
    teacherUserId,
    title,
    triggerToast,
  ]);

  const clearUploadDraft = useCallback(() => {
    setFile(null);
    setTitle('');
    setPendingUpload(null);
  }, []);

  const canManage = useCallback(
    (material) => isTeacherOwnedMaterial(material, teacherUserId),
    [teacherUserId],
  );

  const edit = useCallback((material) => {
    if (!canManage(material)) {
      triggerToast('Bạn chỉ có thể chỉnh sửa tài liệu do chính mình tải lên.');
      return;
    }
    setEditing(material);
  }, [canManage, triggerToast]);

  const update = useCallback(async (values) => {
    const materialId = getRecordId(editing);
    if (!materialId || !canManage(editing)) {
      triggerToast('Bạn không có quyền chỉnh sửa tài liệu này.');
      return;
    }

    return runLocked(`teacher:material:update:${materialId}`, async () => {
      setUpdating(true);
      try {
        await materialsApi.updateMaterialMetadata(courseId, materialId, {
          title: String(values?.title || '').trim(),
          category: String(values?.category || '').trim(),
        });
        setEditing(null);
        triggerToast('Đã cập nhật thông tin tài liệu.');
        await onReload?.();
      } catch (error) {
        triggerToast(getUserFacingError(error, 'Không thể cập nhật tài liệu.'));
      } finally {
        setUpdating(false);
      }
    });
  }, [canManage, courseId, editing, onReload, runLocked, triggerToast]);

  const remove = useCallback((material, anchorRect) => {
    const materialId = getRecordId(material);
    if (!materialId) {
      triggerToast('Học liệu này thiếu mã định danh.');
      return;
    }
    if (!canManage(material)) {
      triggerToast('Bạn chỉ có thể xóa tài liệu do chính mình tải lên.');
      return;
    }

    confirmDanger({
      title: 'Xóa tài liệu của bạn?',
      content: 'Tài liệu và các đoạn đã lập chỉ mục của tài liệu này sẽ bị xóa. Thao tác không thể hoàn tác.',
      okText: 'Xóa tài liệu',
      cancelText: 'Hủy',
      anchorRect,
      onOk: () => runLocked(`teacher:material:delete:${materialId}`, async () => {
        setActionId(`delete:${materialId}`);
        try {
          await materialsApi.deleteMaterial(courseId, materialId);
          triggerToast('Đã xóa tài liệu.');
          await onReload?.();
        } catch (error) {
          triggerToast(getUserFacingError(error, 'Không thể xóa tài liệu.'));
        } finally {
          setActionId('');
        }
      }),
    });
  }, [canManage, courseId, onReload, runLocked, triggerToast]);

  return {
    file,
    setFile,
    title,
    setTitle,
    uploading,
    actionId,
    editing,
    setEditing,
    updating,
    pendingUpload: resolvedPendingUpload,
    clearUploadDraft,
    upload,
    canManage,
    edit,
    update,
    remove,
  };
}
