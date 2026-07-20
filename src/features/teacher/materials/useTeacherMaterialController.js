import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getUserFacingError } from '../../../services/apiClient';
import { materialsApi } from '../../../services/materialsApi';
import { useMutationLock } from '../../../hooks/useMutationLock';
import { getRecordId } from '../shared/teacherUtils';

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

  const runAction = useCallback(async (action, material) => {
    const materialId = getRecordId(material);
    if (!materialId) {
      triggerToast('Học liệu này thiếu mã định danh.');
      return;
    }

    return runLocked(`teacher:material:${action}:${materialId}`, async () => {
      setActionId(`${action}:${materialId}`);
      try {
        if (action === 'reindex') {
          await materialsApi.reindexMaterial(courseId, materialId, teacherUserId);
          triggerToast('Đã gửi yêu cầu lập chỉ mục lại học liệu.');
        } else if (action === 'delete') {
          await materialsApi.deleteMaterial(courseId, materialId, teacherUserId);
          triggerToast('Đã xóa học liệu.');
        } else {
          throw new Error(`Unsupported material action: ${action}`);
        }
        await onReload?.();
      } catch (error) {
        triggerToast(getUserFacingError(
          error,
          action === 'delete' ? 'Không thể xóa học liệu.' : 'Không thể lập chỉ mục lại học liệu.',
        ));
      } finally {
        setActionId('');
      }
    });
  }, [courseId, onReload, runLocked, teacherUserId, triggerToast]);

  return {
    file,
    setFile,
    title,
    setTitle,
    uploading,
    actionId,
    pendingUpload: resolvedPendingUpload,
    clearUploadDraft,
    upload,
    runAction,
  };
}
