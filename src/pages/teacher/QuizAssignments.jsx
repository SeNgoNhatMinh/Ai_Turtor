import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Button, Card, Checkbox, Empty, Form, Input, InputNumber, Modal, Select, Space, Tag, Tooltip, Typography } from 'antd';
import { getUserFacingError } from '../../services/apiClient';
import { quizApi } from '../../services/quizApi';
import { teacherApi } from '../../services/teacherApi';
import { asArray } from '../../services/normalizers';
import { quizGateway } from '../../features/ai-harness/quizGateway';
import QuizDraftEditor from './QuizDraftEditor';
import TeacherOnlineQuizForm from './TeacherOnlineQuizForm';
import { getPersonDisplayName, getPersonEmail, getPersonId } from '../../utils/displayNames';
import {
  findTeacherClass,
  getClassCourseId,
  getClassOptionLabel,
  getClassOptionValue,
} from '../../features/teacher/shared/teacherUtils';
import { validateQuizDraft } from '../../features/teacher/quizzes/quizDraftUtils';
import { classIdMatches } from '../../utils/academicIds';
import '../student/Quiz.css';

const { Text, Title } = Typography;
const getAssignmentId = (assignment) => assignment?.assignmentId || assignment?.id;

function QuizAssignments({
  teacherId,
  teacherName = '',
  courseId,
  classId,
  classesList = [],
  classesLoading = false,
  onClassChange,
  teacherStudents = [],
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
      `${getPersonDisplayName(student, 'Student')} ${getPersonEmail(student)} ${getPersonId(student)}`
        .toLocaleLowerCase()
        .includes(keyword)
    ));
  }, [publishStudents, studentKeyword]);

  const loadAssignments = useCallback(async () => {
    if (!teacherId) return;
    try {
      setAssignments(await quizApi.getTeacherQuizAssignments(teacherId));
    } catch (error) {
      triggerToast?.(getUserFacingError(error, 'Unable to load quiz assignments.'));
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
      getAssignmentId(assignment) === getAssignmentId(draft)
    ));
    if (openDraftMatchesScope) return;

    const nextDraft = scopedAssignments.find((assignment) => (
      String(assignment?.status || 'DRAFT').toUpperCase() === 'DRAFT'
    )) || null;
    const syncTimer = window.setTimeout(() => {
      setDraft(nextDraft);
      setDraftEditorState({
        dirty: false,
        valid: nextDraft ? validateQuizDraft(nextDraft.questions || []).valid : true,
      });
    }, 0);
    return () => window.clearTimeout(syncTimer);
  }, [classId, courseId, draft, scopedAssignments]);

  const applyClassSwitch = (nextClassId) => {
    setPendingClassSwitch(null);
    setPublishOpen(false);
    setDraft(null);
    setDraftEditorState({ dirty: false, valid: true });
    form.setFieldValue('classId', nextClassId);
    onClassChange?.(nextClassId);
  };

  const requestClassSwitch = (nextClassId) => {
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
  };

  const generateDraft = async (values) => {
    const selectedClassId = values.classId || classId;
    const selectedClass = findTeacherClass(classesList, selectedClassId);
    const selectedCourseId = getClassCourseId(selectedClass) || courseId;
    if (!selectedCourseId || !selectedClassId) {
      triggerToast?.('Choose a teaching class before generating the quiz.');
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
      triggerToast?.('Quiz draft generated. Review the questions before publishing.');
    } catch (error) {
      triggerToast?.(getUserFacingError(error, 'Not enough indexed course material to generate this quiz. Please upload or reindex materials first.'));
    } finally {
      setLoading(false);
    }
  };

  const saveDraft = async (payload) => {
    const assignmentId = getAssignmentId(draft);
    if (!assignmentId) return null;
    setSaving(true);
    try {
      const updated = await quizApi.updateQuizAssignment(assignmentId, payload);
      setDraft(updated);
      setDraftEditorState({ dirty: false, valid: validateQuizDraft(updated?.questions || []).valid });
      await loadAssignments();
      triggerToast?.('Quiz draft saved.');
      return updated;
    } catch (error) {
      triggerToast?.(getUserFacingError(error, 'Unable to save quiz draft.'));
      return null;
    } finally {
      setSaving(false);
    }
  };

  const deleteDraft = async (assignment) => {
    const assignmentId = getAssignmentId(assignment);
    if (!assignmentId) return;
    try {
      await quizApi.deleteQuizAssignment(assignmentId);
      if (getAssignmentId(draft) === assignmentId) {
        setDraft(null);
        setDraftEditorState({ dirty: false, valid: true });
      }
      await loadAssignments();
      triggerToast?.('Quiz draft deleted.');
    } catch (error) {
      triggerToast?.(getUserFacingError(error, 'Unable to delete quiz draft.'));
    }
  };

  const handleManualQuizCreated = async (createdAssignment) => {
    showDraftEditor(createdAssignment);
    await loadAssignments();
    triggerToast?.('Teacher online quiz draft created. Review it before publishing.');
  };

  const openPublishDialog = async (assignment) => {
    const assignmentId = getAssignmentId(assignment);
    const isOpenDraft = assignmentId && assignmentId === getAssignmentId(draft);
    if (isOpenDraft && draftEditorState.dirty) {
      triggerToast?.('Save your draft changes before publishing.');
      return;
    }
    const draftValidation = validateQuizDraft(assignment?.questions || []);
    if (!draftValidation.valid || (isOpenDraft && !draftEditorState.valid)) {
      triggerToast?.('Review the draft and fix its questions and answer key before publishing.');
      showDraftEditor(assignment);
      return;
    }
    const assignmentClassId = assignment?.classId || classId;
    const assignmentCourseId = assignment?.courseId || courseId;
    if (!assignmentClassId || !assignmentCourseId) {
      triggerToast?.('This draft has no class scope. Generate a new draft after choosing a teaching class.');
      return;
    }
    const matchedClass = findTeacherClass(classesList, assignmentClassId);
    const canonicalClassId = getClassOptionValue(matchedClass);
    if (canonicalClassId && String(canonicalClassId) !== String(assignmentClassId)) {
      triggerToast?.(`This draft uses legacy class code ${assignmentClassId}. Generate a new draft for ${canonicalClassId} before publishing.`);
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
      triggerToast?.(getUserFacingError(error, 'Unable to load this class roster.'));
    } finally {
      setPublishStudentsLoading(false);
    }
  };

  const publishDraft = async () => {
    const assignmentId = getAssignmentId(draft);
    if (!assignmentId || publishing) return;
    if (!draft?.courseId || !draft?.classId) {
      triggerToast?.('This quiz draft is missing its course or class. Generate a new class-scoped draft.');
      return;
    }
    if (publishTarget === 'SELECTED_STUDENTS' && selectedStudents.length === 0) {
      triggerToast?.('Choose at least one student.');
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
      triggerToast?.('Quiz assignment published.');
    } catch (error) {
      triggerToast?.(getUserFacingError(error, 'Unable to publish quiz assignment.'));
    } finally {
      setPublishing(false);
    }
  };

  const toggleStudent = (studentId, checked) => {
    setSelectedStudents((current) => (
      checked
        ? [...new Set([...current, studentId])]
        : current.filter((id) => id !== studentId)
    ));
  };

  const visibleStudentIds = visiblePublishStudents.map(getPersonId).filter(Boolean);
  const allVisibleSelected = visibleStudentIds.length > 0
    && visibleStudentIds.every((studentId) => selectedStudents.includes(studentId));

  return (
    <div className="portal-section quiz-page teacher-quiz-page">
      <div className="quiz-page-header">
        <div>
          <Title level={3} style={{ margin: 0 }}>Quiz Assignments</Title>
          <Text type="secondary">Generate grounded quiz drafts from indexed materials, review them, then publish to a class or selected students.</Text>
        </div>
        <Space wrap>
          {courseId && <Tag color="orange">Course: {courseId}</Tag>}
          {classId && <Tag>Class: {classId}</Tag>}
        </Space>
      </div>

      <div className="quiz-grid">
        <Card className="quiz-card" title="Generate draft">
          <Form form={form} layout="vertical" onFinish={generateDraft} initialValues={{ title: '', topic: '', suggestionText: '', questionCount: 5 }}>
            <Form.Item name="classId" label="Teaching class" rules={[{ required: true, message: 'Choose the class receiving this quiz' }]}>
              <Select
                showSearch
                placeholder="Choose a teaching class"
                optionFilterProp="searchLabel"
                options={classOptions}
                loading={classesLoading}
                disabled={classesLoading || classOptions.length === 0}
                notFoundContent={classesLoading ? 'Loading classes...' : 'No assigned classes found'}
                onChange={requestClassSwitch}
              />
            </Form.Item>
            <Form.Item name="title" label="Quiz title" rules={[{ required: true, message: 'Title is required' }]}>
              <Input placeholder="Example: PRJ301 JPA review quiz" />
            </Form.Item>
            <Form.Item name="topic" label="Topic">
              <Input placeholder="Example: JPA relationships" />
            </Form.Item>
            <Form.Item name="suggestionText" label="Learning goal / suggestion">
              <Input.TextArea rows={2} />
            </Form.Item>
            <Form.Item name="questionCount" label="Question count">
              <InputNumber min={3} max={10} />
            </Form.Item>
            <Button type="primary" htmlType="submit" loading={loading}>Generate draft quiz</Button>
          </Form>
        </Card>

        <Card className="quiz-card" title="Create online quiz">
          <TeacherOnlineQuizForm
            teacherId={teacherId}
            courseId={courseId}
            classId={classId}
            disabled={!courseId || !classId}
            onCreated={handleManualQuizCreated}
            triggerToast={triggerToast}
          />
        </Card>
      </div>

      {draft && (
        <Space ref={draftEditorRef} orientation="vertical" size={12} style={{ width: '100%', scrollMarginTop: 24 }}>
          <QuizDraftEditor
            draft={draft}
            onSave={saveDraft}
            onStateChange={handleDraftStateChange}
            saving={saving}
            readOnly={String(draft.status || 'DRAFT').toUpperCase() !== 'DRAFT'}
          />
          {String(draft.status || 'DRAFT').toUpperCase() === 'DRAFT' && (
            <Space>
              <Tooltip title={draftEditorState.dirty ? 'Save your changes before publishing' : !draftEditorState.valid ? 'Fix the draft validation errors first' : ''}>
                <span>
                  <Button
                    type="primary"
                    disabled={draftEditorState.dirty || !draftEditorState.valid}
                    onClick={() => openPublishDialog(draft)}
                  >
                    Publish draft
                  </Button>
                </span>
              </Tooltip>
              <Button danger onClick={() => deleteDraft(draft)}>Delete draft</Button>
            </Space>
          )}
        </Space>
      )}

      <Card
        className="quiz-card"
        title="Teacher quiz assignments"
        extra={courseId && classId ? <Text type="secondary">{courseId} / {classId}</Text> : null}
      >
        {scopedAssignments.length ? (
          <div className="quiz-assignment-list">
            {scopedAssignments.map((item) => (
              <div key={item.assignmentId || item.id} className="quiz-assignment-row">
                  <div>
                    <Text strong>{item.title || item.topic || 'Quiz assignment'}</Text>
                    <div>
                      <Text type="secondary">{item.status || 'Draft'} {item.classId ? `- ${item.classId}` : ''}</Text>
                      {item.gradingMode && (
                        <Tag style={{ marginLeft: 8 }}>
                          {String(item.gradingMode).toUpperCase() === 'TEACHER_MANUAL'
                            ? 'Teacher manual'
                            : String(item.gradingMode).toUpperCase() === 'AI_ASSISTED'
                              ? 'AI assisted'
                              : 'AI auto-graded'}
                        </Tag>
                      )}
                  </div>
                </div>
                <Space wrap>
                  {String(item.status || 'DRAFT').toUpperCase() === 'DRAFT' ? (
                    <>
                      <Button size="small" onClick={() => showDraftEditor(item)}>Edit</Button>
                      <Tooltip title={getAssignmentId(draft) === getAssignmentId(item) && draftEditorState.dirty ? 'Save the open draft first' : ''}>
                        <span>
                          <Button
                            size="small"
                            type="primary"
                            disabled={getAssignmentId(draft) === getAssignmentId(item) && draftEditorState.dirty}
                            onClick={() => openPublishDialog(item)}
                          >
                            Publish
                          </Button>
                        </span>
                      </Tooltip>
                      <Button size="small" danger onClick={() => deleteDraft(item)}>Delete</Button>
                    </>
                  ) : (
                    <Space wrap size={6}>
                      <Tag color="green">Published - read only</Tag>
                      <Text type="secondary">
                        {item.targetType === 'SELECTED_STUDENTS'
                          ? `${item.targetStudentIds?.length || 0} selected students`
                          : 'Entire class'}
                      </Text>
                      <Button size="small" onClick={() => showDraftEditor(item)}>View</Button>
                    </Space>
                  )}
                </Space>
              </div>
            ))}
          </div>
        ) : (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={courseId && classId
              ? `No quiz assignments for ${courseId} / ${classId}`
              : 'Choose a teaching class to view its quiz assignments'}
          />
        )}
      </Card>

      <Modal
        title="Switch teaching class?"
        open={Boolean(pendingClassSwitch)}
        onCancel={() => setPendingClassSwitch(null)}
        onOk={() => pendingClassSwitch && applyClassSwitch(pendingClassSwitch.classId)}
        okText="Switch class"
        cancelText="Keep editing"
      >
        <Text>
          You have unsaved changes in the current quiz draft. Switching to{' '}
          <Text strong>
            {pendingClassSwitch?.courseId || 'Course'} / {pendingClassSwitch?.classId || pendingClassSwitch?.label}
          </Text>{' '}
          will discard those local changes and open that class&apos;s saved draft.
        </Text>
      </Modal>

      <Modal
        className="quiz-publish-modal"
        title="Publish quiz assignment"
        open={publishOpen}
        onCancel={() => !publishing && setPublishOpen(false)}
        onOk={publishDraft}
        confirmLoading={publishing}
        okText="Publish quiz"
        width={620}
        okButtonProps={{ disabled: publishing || (publishTarget === 'SELECTED_STUDENTS' && selectedStudents.length === 0) }}
      >
        <Space orientation="vertical" size={16} style={{ width: '100%' }}>
          <div className="quiz-publish-scope">
            <div>
              <Text strong>{draft?.title || 'Quiz assignment'}</Text>
              <Text type="secondary">The saved correct answers become the official answer key. Published quizzes cannot be edited.</Text>
            </div>
            <Space wrap size={6}>
              <Tag color="orange">{draft?.courseId || courseId}</Tag>
              <Tag>{draft?.classId || classId}</Tag>
            </Space>
          </div>
          <Select
            value={publishTarget}
            onChange={(value) => {
              setPublishTarget(value);
              setSelectedStudents([]);
            }}
            style={{ width: '100%' }}
            options={[
              { value: 'CLASS', label: 'Entire class' },
              { value: 'SELECTED_STUDENTS', label: 'Selected students' },
            ]}
          />
          {publishTarget === 'SELECTED_STUDENTS' && (
            <div className="quiz-student-picker">
              <div className="quiz-student-picker-header">
                <div>
                  <Text strong>Choose students by name</Text>
                  <Text type="secondary">{selectedStudents.length} selected from {publishStudents.length}</Text>
                </div>
                <Button
                  size="small"
                  disabled={publishStudentsLoading || visibleStudentIds.length === 0}
                  onClick={() => setSelectedStudents((current) => (
                    allVisibleSelected
                      ? current.filter((id) => !visibleStudentIds.includes(id))
                      : [...new Set([...current, ...visibleStudentIds])]
                  ))}
                >
                  {allVisibleSelected ? 'Clear visible' : 'Select visible'}
                </Button>
              </div>
              <Input.Search
                allowClear
                value={studentKeyword}
                onChange={(event) => setStudentKeyword(event.target.value)}
                placeholder="Search student name or email"
              />
              {publishStudentsLoading ? (
                <div className="quiz-student-picker-empty">Loading class roster...</div>
              ) : visiblePublishStudents.length === 0 ? (
                <Alert
                  type="warning"
                  showIcon
                  title={studentKeyword ? 'No students match your search' : 'No students found in this class'}
                  description="Check the selected class and its enrollments before publishing."
                />
              ) : (
                <div className="quiz-student-picker-list">
                  {visiblePublishStudents.map((student) => {
                    const studentId = getPersonId(student);
                    const studentName = getPersonDisplayName(student, 'Student');
                    const studentEmail = getPersonEmail(student);
                    return (
                      <label key={studentId} className="quiz-student-picker-item">
                        <Checkbox
                          checked={selectedStudents.includes(studentId)}
                          onChange={(event) => toggleStudent(studentId, event.target.checked)}
                        />
                        <span>
                          <strong>{studentName}</strong>
                          <small>{studentEmail || 'No email provided'}</small>
                        </span>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </Space>
      </Modal>
    </div>
  );
}

export default QuizAssignments;
