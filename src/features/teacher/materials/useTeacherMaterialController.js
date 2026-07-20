import { useCallback, useEffect, useRef, useState } from 'react';
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
  triggerToast,
}) {
  const [file, setFile] = useState(null);
  const [title, setTitle] = useState('');
  const [uploading, setUploading] = useState(false);
  const [actionId, setActionId] = useState('');
  const cooldownTimerRef = useRef(null);
  const { runLocked } = useMutationLock();

  useEffect(() => () => window.clearTimeout(cooldownTimerRef.current), []);

  const upload = useCallback(async (event) => {
    event.preventDefault();
    if (!courseId || !classId) {
      triggerToast('Select a teaching class in the "Teaching class" field above.');
      return;
    }
    if (!file) {
      triggerToast('Choose a PDF file to upload.');
      return;
    }
    if (!teacherUserId) {
      triggerToast('Your teacher account could not be identified. Please sign in again.');
      return;
    }
    if (!String(file.name || '').toLowerCase().endsWith('.pdf')) {
      triggerToast('Only PDF course materials are supported.');
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
        await materialsApi.uploadMaterial(courseId, formData);
        setFile(null);
        setTitle('');
        triggerToast('Class material upload accepted. Indexing is running in the background.');
        await onReload?.();
      } catch (error) {
        triggerToast(getUserFacingError(error, 'Unable to upload class material.'));
      } finally {
        cooldownTimerRef.current = window.setTimeout(() => {
          setUploading(false);
        }, UPLOAD_COOLDOWN_MS);
      }
    });
  }, [classId, courseId, file, onReload, runLocked, teacherUserId, title, triggerToast]);

  const runAction = useCallback(async (action, material) => {
    const materialId = getRecordId(material);
    if (!materialId) {
      triggerToast('This material is missing an ID.');
      return;
    }

    return runLocked(`teacher:material:${action}:${materialId}`, async () => {
      setActionId(`${action}:${materialId}`);
      try {
        if (action === 'reindex') {
          await materialsApi.reindexMaterial(courseId, materialId, teacherUserId);
          triggerToast('Material reindexing triggered.');
        } else if (action === 'delete') {
          await materialsApi.deleteMaterial(courseId, materialId, teacherUserId);
          triggerToast('Material deleted.');
        } else {
          throw new Error(`Unsupported material action: ${action}`);
        }
        await onReload?.();
      } catch (error) {
        triggerToast(getUserFacingError(
          error,
          action === 'delete' ? 'Unable to delete material.' : 'Unable to reindex material.',
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
    upload,
    runAction,
  };
}
