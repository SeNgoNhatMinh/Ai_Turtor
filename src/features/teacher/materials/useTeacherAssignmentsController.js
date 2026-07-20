import { useCallback, useEffect, useState } from 'react';
import { assignmentApi } from '../../../services/assignmentApi';
import { getUserFacingError } from '../../../services/apiClient';
import { normalizeAssignment } from '../../../services/normalizers';
import { useMutationLock } from '../../../hooks/useMutationLock';
import { validateAssignmentFile } from '../../../utils/assignmentFiles';
import { getRecordId } from '../shared/teacherUtils';

function getAssignmentItems(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.assignments)) return data.assignments;
  if (Array.isArray(data?.content)) return data.content;
  return [];
}

export function useTeacherAssignmentsController({
  courseId,
  classId,
  teacherUserId,
  triggerToast,
}) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState('ASSIGNMENT');
  const [maxScore, setMaxScore] = useState('10');
  const [deadline, setDeadline] = useState('');
  const [file, setFileState] = useState(null);
  const [targetType, setTargetType] = useState('ALL_CLASS');
  const [targetStudents, setTargetStudents] = useState('');
  const [publishing, setPublishing] = useState(false);
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState(null);
  const [updating, setUpdating] = useState(false);
  const { runLocked } = useMutationLock();

  useEffect(() => {
    const timer = window.setTimeout(() => setTargetStudents(''), 0);
    return () => window.clearTimeout(timer);
  }, [classId]);

  const load = useCallback(async () => {
    if (!courseId || !classId || !teacherUserId) {
      setRecords([]);
      return [];
    }

    setLoading(true);
    try {
      const data = await assignmentApi.getClassAssignments(courseId, classId, teacherUserId);
      const normalized = getAssignmentItems(data).map(normalizeAssignment);
      setRecords(normalized);
      return normalized;
    } catch (error) {
      setRecords([]);
      triggerToast(getUserFacingError(error, 'Không thể tải bài tập của lớp.'));
      return [];
    } finally {
      setLoading(false);
    }
  }, [classId, courseId, teacherUserId, triggerToast]);

  const setFile = useCallback((nextFile) => {
    if (!nextFile) {
      setFileState(null);
      return true;
    }

    const validation = validateAssignmentFile(nextFile);
    if (!validation.ok) {
      setFileState(null);
      triggerToast(validation.message);
      return false;
    }

    setFileState(nextFile);
    return true;
  }, [triggerToast]);

  const resetDraft = useCallback(() => {
    setTitle('');
    setDescription('');
    setType('ASSIGNMENT');
    setMaxScore('10');
    setDeadline('');
    setFileState(null);
    setTargetType('ALL_CLASS');
    setTargetStudents('');
  }, []);

  const create = useCallback(async (event) => {
    event.preventDefault();
    if (!courseId || !classId || !teacherUserId) {
      triggerToast('Hãy chọn môn học và lớp trước khi xuất bản.');
      return;
    }
    if (!title.trim()) {
      triggerToast('Hãy nhập tên bài tập.');
      return;
    }

    const fileValidation = validateAssignmentFile(file);
    if (!fileValidation.ok) {
      triggerToast(fileValidation.message);
      return;
    }

    const normalizedMaxScore = Number(maxScore);
    if (!Number.isFinite(normalizedMaxScore) || normalizedMaxScore <= 0 || normalizedMaxScore > 1000) {
      triggerToast('Điểm tối đa phải lớn hơn 0 và không vượt quá 1000.');
      return;
    }
    if (targetType === 'SELECTED_STUDENTS' && !targetStudents.trim()) {
      triggerToast('Hãy chọn ít nhất một sinh viên.');
      return;
    }

    return runLocked('teacher:assignment:publish', async () => {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('teacherId', teacherUserId);
      formData.append('title', title.trim());
      if (description.trim()) formData.append('description', description.trim());
      formData.append('assignmentType', type);
      formData.append('maxScore', String(normalizedMaxScore));
      formData.append('targetType', targetType);
      if (targetType === 'SELECTED_STUDENTS') {
        formData.append('targetStudentIds', targetStudents.trim());
      }
      if (deadline) formData.append('dueAt', new Date(deadline).toISOString());

      setPublishing(true);
      try {
        await assignmentApi.uploadAssignment(courseId, classId, formData);
        triggerToast('Đã xuất bản bài tập.');
        resetDraft();
        await load();
      } catch (error) {
        triggerToast(getUserFacingError(error, 'Không thể xuất bản bài tập.'));
      } finally {
        setPublishing(false);
      }
    });
  }, [
    classId,
    courseId,
    deadline,
    description,
    file,
    load,
    maxScore,
    resetDraft,
    runLocked,
    targetStudents,
    targetType,
    teacherUserId,
    title,
    triggerToast,
    type,
  ]);

  const remove = useCallback(async (assignment) => {
    const assignmentId = getRecordId(assignment);
    if (!assignmentId) {
      triggerToast('Bài tập này thiếu mã định danh.');
      return;
    }

    try {
      await assignmentApi.deleteAssignment(assignmentId, teacherUserId);
      triggerToast('Đã xóa bài tập.');
      await load();
    } catch (error) {
      triggerToast(getUserFacingError(
        error,
        'Không thể xóa bài tập. Chỉ được xóa khi chưa có bài nộp.',
      ));
    }
  }, [load, teacherUserId, triggerToast]);

  const edit = useCallback(async (assignment) => {
    const assignmentId = getRecordId(assignment);
    if (!assignmentId) {
      triggerToast('Bài tập này thiếu mã định danh.');
      return;
    }

    try {
      const detail = await assignmentApi.getAssignmentDetail(assignmentId);
      setEditing(detail || assignment);
    } catch (error) {
      triggerToast(getUserFacingError(error, 'Không thể tải chi tiết bài tập.'));
    }
  }, [triggerToast]);

  const update = useCallback(async (values) => {
    const assignmentId = getRecordId(editing);
    if (!assignmentId || updating) return;

    setUpdating(true);
    try {
      await assignmentApi.updateAssignment(assignmentId, {
        ...values,
        teacherId: teacherUserId,
      });
      setEditing(null);
      triggerToast('Đã cập nhật bài tập.');
      await load();
    } catch (error) {
      triggerToast(getUserFacingError(
        error,
        'Không thể cập nhật bài tập này. Bài tập đã có bài nộp không thể chỉnh sửa.',
      ));
    } finally {
      setUpdating(false);
    }
  }, [editing, load, teacherUserId, triggerToast, updating]);

  const download = useCallback(async (assignment) => {
    const assignmentId = getRecordId(assignment);
    if (!assignmentId) {
      triggerToast('Bài tập này thiếu mã định danh.');
      return;
    }

    try {
      const blob = await assignmentApi.downloadAssignmentFile(assignmentId);
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = assignment.attachmentFileName || `assignment-${assignmentId}`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      triggerToast(getUserFacingError(error, 'Không thể tải tệp bài tập.'));
    }
  }, [triggerToast]);

  return {
    draft: {
      title,
      setTitle,
      description,
      setDescription,
      classId,
      courseId,
      type,
      setType,
      maxScore,
      setMaxScore,
      deadline,
      setDeadline,
      file,
      setFile,
      targetType,
      setTargetType,
      targetStudents,
      setTargetStudents,
      isPublishing: publishing,
    },
    records,
    loading,
    load,
    create,
    remove,
    edit,
    download,
    editing,
    setEditing,
    updating,
    update,
  };
}
