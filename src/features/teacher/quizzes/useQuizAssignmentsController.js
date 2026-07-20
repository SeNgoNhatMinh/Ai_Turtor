import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Form } from 'antd';
import { getUserFacingError } from '../../../services/apiClient';
import { quizApi } from '../../../services/quizApi';
import { teacherApi } from '../../../services/teacherApi';
import { asArray } from '../../../services/normalizers';
import { quizGateway } from '../../ai-harness/quizGateway';
import { getPersonDisplayName, getPersonEmail, getPersonId } from '../../../utils/displayNames';
import {
  findTeacherClass,
  getClassCourseId,
  getClassOptionLabel,
  getClassOptionValue,
} from '../shared/teacherUtils';
import { classIdMatches } from '../../../utils/academicIds';
import { validateQuizDraft } from './quizDraftUtils';
import { getQuizAssignmentId, isQuizDraft } from './quizAssignmentUtils';

export function useQuizAssignmentsController({
  teacherId,
  teacherName,
  courseId,
  classId,
  classesList,
  onClassChange,
  teacherStudents,
  triggerToast,
}) {
  const [form] = Form.useForm();
  const [assignments, setAssignments] = useState([]);
  const [draft, setDraft] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [publishOpen, setPublishOpen] = useState(false);
  const [publishTarget, setPublishTarget] = useState('CLASS');
  const [selectedStudents, setSelectedStudents] = useState([]);
  const [publishStudents, setPublishStudents] = useState([]);
  const [publishStudentsLoading, setPublishStudentsLoading] = useState(false);
  const [studentKeyword, setStudentKeyword] = useState('');
  const [draftEditorState, setDraftEditorState] = useState({ dirty: false, valid: true });
  const [pendingClassSwitch, setPendingClassSwitch] = useState(null);
  const draftEditorRef = useRef(null);

  const handleDraftStateChange = useCallback((nextState) => {
    setDraftEditorState((current) => (
      current.dirty === nextState.dirty && current.valid === nextState.valid ? current : nextState
    ));
  }, []);

  const showDraftEditor = useCallback((nextDraft) => {
    setDraft(nextDraft);
    setDraftEditorState({ dirty: false, valid: validateQuizDraft(nextDraft?.questions || []).valid });
    window.requestAnimationFrame(() => {
      draftEditorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }, []);

  const classOptions = useMemo(() => classesList
    .map((item) => {
      const value = getClassOptionValue(item);
      const optionCourseId = getClassCourseId(item);
      const classLabel = getClassOptionLabel(item);
      return value ? {
        value: String(value),
        label: optionCourseId ? `${classLabel} · ${optionCourseId}` : classLabel,
        searchLabel: `${classLabel} ${value} ${optionCourseId}`,
      } : null;
    })
    .filter(Boolean), [classesList]);

  const scopedAssignments = useMemo(() => assignments.filter((assignment) => {
    const assignmentCourseId = String(assignment?.courseId || '').trim().toUpperCase();
    const selectedCourseId = String(courseId || '').trim().toUpperCase();
    const courseMatches = !selectedCourseId || assignmentCourseId === selectedCourseId;
    const classMatches = !classId || classIdMatches(assignment?.classId, classId);
    return courseMatches && classMatches;
  }), [assignments, classId, courseId]);

  const visiblePublishStudents = useMemo(() => {
    const keyword = studentKeyword.trim().toLocaleLowerCase();
    if (!keyword) return publishStudents;
    return publishStudents.filter((student) => (
      `${getPersonDisplayName(student, 'Sinh viên')} ${getPersonEmail(student)} ${getPersonId(student)}`
        .toLocaleLowerCase()
        .includes(keyword)
    ));
  }, [publishStudents, studentKeyword]);

  const visibleStudentIds = useMemo(
    () => visiblePublishStudents.map(getPersonId).filter(Boolean),
    [visiblePublishStudents],
  );
  const allVisibleSelected = visibleStudentIds.length > 0
    && visibleStudentIds.every((studentId) => selectedStudents.includes(studentId));

  const loadAssignments = useCallback(async () => {
    if (!teacherId) return;
    try {
      setAssignments(await quizApi.getTeacherQuizAssignments(teacherId));
    } catch (error) {
      triggerToast?.(getUserFacingError(error, 'Không thể tải danh sách quiz.'));
    }
  }, [teacherId, triggerToast]);

  useEffect(() => {
    const loadTimer = window.setTimeout(loadAssignments, 0);
    return () => window.clearTimeout(loadTimer);
  }, [courseId, loadAssignments]);

  useEffect(() => {
    form.setFieldValue('classId', classId || undefined);
  }, [classId, form]);

  useEffect(() => {
    if (!courseId && !classId) return;
    const openDraftMatchesScope = draft && scopedAssignments.some((assignment) => (
      getQuizAssignmentId(assignment) === getQuizAssignmentId(draft)
    ));
    if (openDraftMatchesScope) return;

    const nextDraft = scopedAssignments.find(isQuizDraft) || null;
    const syncTimer = window.setTimeout(() => {
      setDraft(nextDraft);
      setDraftEditorState({
        dirty: false,
        valid: nextDraft ? validateQuizDraft(nextDraft.questions || []).valid : true,
      });
    }, 0);
    return () => window.clearTimeout(syncTimer);
  }, [classId, courseId, draft, scopedAssignments]);

  const applyClassSwitch = useCallback((nextClassId) => {
    setPendingClassSwitch(null);
    setPublishOpen(false);
    setDraft(null);
    setDraftEditorState({ dirty: false, valid: true });
    form.setFieldValue('classId', nextClassId);
    onClassChange?.(nextClassId);
  }, [form, onClassChange]);

  const requestClassSwitch = useCallback((nextClassId) => {
    if (classIdMatches(nextClassId, classId)) return;
    if (draftEditorState.dirty) {
      const nextClass = findTeacherClass(classesList, nextClassId);
      setPendingClassSwitch({
        classId: nextClassId,
        courseId: getClassCourseId(nextClass),
        label: getClassOptionLabel(nextClass),
      });
      form.setFieldValue('classId', classId || undefined);
      return;
    }
    applyClassSwitch(nextClassId);
  }, [applyClassSwitch, classId, classesList, draftEditorState.dirty, form]);

  const generateDraft = async (values) => {
    const selectedClassId = values.classId || classId;
    const selectedClass = findTeacherClass(classesList, selectedClassId);
    const selectedCourseId = getClassCourseId(selectedClass) || courseId;
    if (!selectedCourseId || !selectedClassId) {
      triggerToast?.('Chọn lớp học phần trước khi tạo quiz.');
      return;
    }

    setLoading(true);
    try {
      onClassChange?.(selectedClassId);
      const nextDraft = await quizGateway.generateTeacherDraft({
        teacherId,
        teacherName,
        courseId: selectedCourseId,
        classId: selectedClassId,
        payload: { ...values, classId: selectedClassId },
      });
      showDraftEditor(nextDraft);
      await loadAssignments();
      triggerToast?.('Đã tạo draft quiz. Hãy kiểm tra câu hỏi trước khi xuất bản.');
    } catch (error) {
      triggerToast?.(getUserFacingError(error, 'Chưa đủ tài liệu đã lập chỉ mục để tạo quiz. Hãy tải lên hoặc lập chỉ mục lại tài liệu.'));
    } finally {
      setLoading(false);
    }
  };

  const saveDraft = async (payload) => {
    const assignmentId = getQuizAssignmentId(draft);
    if (!assignmentId) return null;
    setSaving(true);
    try {
      const updated = await quizApi.updateQuizAssignment(assignmentId, payload);
      setDraft(updated);
      setDraftEditorState({ dirty: false, valid: validateQuizDraft(updated?.questions || []).valid });
      await loadAssignments();
      triggerToast?.('Đã lưu draft quiz.');
      return updated;
    } catch (error) {
      triggerToast?.(getUserFacingError(error, 'Không thể lưu draft quiz.'));
      return null;
    } finally {
      setSaving(false);
    }
  };

  const deleteDraft = async (assignment) => {
    const assignmentId = getQuizAssignmentId(assignment);
    if (!assignmentId) return;
    try {
      await quizApi.deleteQuizAssignment(assignmentId);
      if (getQuizAssignmentId(draft) === assignmentId) {
        setDraft(null);
        setDraftEditorState({ dirty: false, valid: true });
      }
      await loadAssignments();
      triggerToast?.('Đã xóa draft quiz.');
    } catch (error) {
      triggerToast?.(getUserFacingError(error, 'Không thể xóa draft quiz.'));
    }
  };

  const handleManualQuizCreated = async (createdAssignment) => {
    showDraftEditor(createdAssignment);
    await loadAssignments();
    triggerToast?.('Đã tạo draft quiz trực tuyến. Hãy kiểm tra trước khi xuất bản.');
  };

  const openPublishDialog = async (assignment) => {
    const assignmentId = getQuizAssignmentId(assignment);
    const isOpenDraft = assignmentId && assignmentId === getQuizAssignmentId(draft);
    if (isOpenDraft && draftEditorState.dirty) {
      triggerToast?.('Hãy lưu thay đổi trước khi xuất bản.');
      return;
    }
    const draftValidation = validateQuizDraft(assignment?.questions || []);
    if (!draftValidation.valid || (isOpenDraft && !draftEditorState.valid)) {
      triggerToast?.('Kiểm tra lại câu hỏi và đáp án đúng trước khi xuất bản.');
      showDraftEditor(assignment);
      return;
    }

    const assignmentClassId = assignment?.classId || classId;
    const assignmentCourseId = assignment?.courseId || courseId;
    if (!assignmentClassId || !assignmentCourseId) {
      triggerToast?.('Draft chưa có phạm vi lớp. Hãy chọn lớp rồi tạo draft mới.');
      return;
    }
    const matchedClass = findTeacherClass(classesList, assignmentClassId);
    const canonicalClassId = getClassOptionValue(matchedClass);
    if (canonicalClassId && String(canonicalClassId) !== String(assignmentClassId)) {
      triggerToast?.(`Draft đang dùng mã lớp cũ ${assignmentClassId}. Hãy tạo draft mới cho ${canonicalClassId}.`);
      return;
    }

    setDraft(assignment);
    setPublishTarget('CLASS');
    setSelectedStudents([]);
    setStudentKeyword('');
    setPublishOpen(true);
    setPublishStudentsLoading(true);
    try {
      const data = await teacherApi.getClassStudents(assignmentCourseId, assignmentClassId, teacherId);
      const roster = asArray(data, 'students', 'content', 'enrollments')
        .filter((student) => getPersonId(student));
      setPublishStudents(roster.length ? roster : teacherStudents);
    } catch (error) {
      setPublishStudents(teacherStudents);
      triggerToast?.(getUserFacingError(error, 'Không thể tải danh sách sinh viên của lớp.'));
    } finally {
      setPublishStudentsLoading(false);
    }
  };

  const publishDraft = async () => {
    const assignmentId = getQuizAssignmentId(draft);
    if (!assignmentId || publishing) return;
    if (!draft?.courseId || !draft?.classId) {
      triggerToast?.('Draft quiz đang thiếu môn hoặc lớp. Hãy tạo lại theo lớp học phần.');
      return;
    }
    if (publishTarget === 'SELECTED_STUDENTS' && selectedStudents.length === 0) {
      triggerToast?.('Chọn ít nhất một sinh viên.');
      return;
    }
    setPublishing(true);
    try {
      await quizApi.publishQuizAssignment(assignmentId, {
        targetType: publishTarget,
        targetStudentIds: publishTarget === 'SELECTED_STUDENTS' ? selectedStudents : [],
      });
      setPublishOpen(false);
      setDraft(null);
      setDraftEditorState({ dirty: false, valid: true });
      await loadAssignments();
      triggerToast?.('Đã xuất bản quiz.');
    } catch (error) {
      triggerToast?.(getUserFacingError(error, 'Không thể xuất bản quiz.'));
    } finally {
      setPublishing(false);
    }
  };

  const changePublishTarget = (value) => {
    setPublishTarget(value);
    setSelectedStudents([]);
  };

  const toggleStudent = (studentId, checked) => {
    setSelectedStudents((current) => (
      checked
        ? [...new Set([...current, studentId])]
        : current.filter((id) => id !== studentId)
    ));
  };

  const toggleVisibleStudents = () => {
    setSelectedStudents((current) => (
      allVisibleSelected
        ? current.filter((id) => !visibleStudentIds.includes(id))
        : [...new Set([...current, ...visibleStudentIds])]
    ));
  };

  return {
    form,
    classOptions,
    scopedAssignments,
    draft,
    draftEditorRef,
    draftEditorState,
    loading,
    saving,
    publishing,
    publishOpen,
    publishTarget,
    selectedStudents,
    publishStudents,
    publishStudentsLoading,
    visiblePublishStudents,
    visibleStudentIds,
    allVisibleSelected,
    studentKeyword,
    pendingClassSwitch,
    handleDraftStateChange,
    showDraftEditor,
    requestClassSwitch,
    applyClassSwitch,
    cancelClassSwitch: () => setPendingClassSwitch(null),
    generateDraft,
    saveDraft,
    deleteDraft,
    handleManualQuizCreated,
    openPublishDialog,
    publishDraft,
    cancelPublish: () => !publishing && setPublishOpen(false),
    changePublishTarget,
    setStudentKeyword,
    toggleStudent,
    toggleVisibleStudents,
  };
}
