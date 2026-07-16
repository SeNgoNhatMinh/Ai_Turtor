import { useCallback, useEffect, useState } from 'react';
import { Button, Card, Empty, Form, Input, InputNumber, Modal, Select, Space, Tag, Typography } from 'antd';
import { getUserFacingError } from '../../services/apiClient';
import { quizApi } from '../../services/quizApi';
import { quizGateway } from '../../features/ai-harness/quizGateway';
import QuizDraftEditor from './QuizDraftEditor';
import { getPersonDisplayName, getPersonEmail } from '../../utils/displayNames';
import '../student/Quiz.css';

const { Text, Title } = Typography;

function QuizAssignments({ teacherId, teacherName = '', courseId, classId, teacherStudents = [], triggerToast }) {
  const [form] = Form.useForm();
  const [assignments, setAssignments] = useState([]);
  const [draft, setDraft] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [publishOpen, setPublishOpen] = useState(false);
  const [publishTarget, setPublishTarget] = useState('CLASS');
  const [selectedStudents, setSelectedStudents] = useState([]);

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

  const generateDraft = async (values) => {
    setLoading(true);
    try {
      const nextDraft = await quizGateway.generateTeacherDraft({
        teacherId,
        teacherName,
        courseId,
        classId,
        payload: values,
      });
      setDraft(nextDraft);
      await loadAssignments();
    } catch (error) {
      triggerToast?.(getUserFacingError(error, 'Not enough indexed course material to generate this quiz. Please upload or reindex materials first.'));
    } finally {
      setLoading(false);
    }
  };

  const saveDraft = async (payload) => {
    const assignmentId = draft?.assignmentId || draft?.id;
    if (!assignmentId) return;
    setSaving(true);
    try {
      const updated = await quizApi.updateQuizAssignment(assignmentId, payload);
      setDraft(updated);
      await loadAssignments();
      triggerToast?.('Quiz draft saved.');
    } catch (error) {
      triggerToast?.(getUserFacingError(error, 'Unable to save quiz draft.'));
    } finally {
      setSaving(false);
    }
  };

  const deleteDraft = async (assignment) => {
    const assignmentId = assignment?.assignmentId || assignment?.id;
    if (!assignmentId) return;
    try {
      await quizApi.deleteQuizAssignment(assignmentId);
      if ((draft?.assignmentId || draft?.id) === assignmentId) setDraft(null);
      await loadAssignments();
      triggerToast?.('Quiz draft deleted.');
    } catch (error) {
      triggerToast?.(getUserFacingError(error, 'Unable to delete quiz draft.'));
    }
  };

  const publishDraft = async () => {
    const assignmentId = draft?.assignmentId || draft?.id;
    if (!assignmentId) return;
    try {
      await quizApi.publishQuizAssignment(assignmentId, {
        targetType: publishTarget,
        targetStudentIds: publishTarget === 'SELECTED_STUDENTS' ? selectedStudents : [],
      });
      setPublishOpen(false);
      setDraft(null);
      await loadAssignments();
      triggerToast?.('Quiz assignment published.');
    } catch (error) {
      triggerToast?.(getUserFacingError(error, 'Unable to publish quiz assignment.'));
    }
  };

  return (
    <div className="portal-section quiz-page">
      <div className="quiz-page-header">
        <div>
          <Title level={3} style={{ margin: 0 }}>Quiz Assignments</Title>
          <Text type="secondary">Generate grounded quiz drafts from indexed materials, review them, then publish to a class or selected students.</Text>
        </div>
        <Tag color="orange">Course: {courseId}</Tag>
      </div>

      <div className="quiz-grid">
        <Card className="quiz-card" title="Generate draft">
          <Form form={form} layout="vertical" onFinish={generateDraft} initialValues={{ title: '', topic: '', suggestionText: '', questionCount: 5 }}>
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

        <Card className="quiz-card" title="Review student attempts">
          <Text type="secondary">
            Open Submission Grading to review completed assigned quizzes. The student list there provides the quiz session automatically, so you do not need to enter technical IDs.
          </Text>
        </Card>
      </div>

      {draft && (
        <Space direction="vertical" size={12} style={{ width: '100%' }}>
          <QuizDraftEditor draft={draft} onSave={saveDraft} saving={saving} />
          <Space>
            <Button type="primary" onClick={() => setPublishOpen(true)}>Publish draft</Button>
            <Button danger onClick={() => deleteDraft(draft)}>Delete draft</Button>
          </Space>
        </Space>
      )}

      <Card className="quiz-card" title="Teacher quiz assignments">
        {assignments.length ? (
          <div className="quiz-assignment-list">
            {assignments.map((item) => (
              <div key={item.assignmentId || item.id} className="quiz-assignment-row">
                <div>
                  <Text strong>{item.title || item.topic || 'Quiz assignment'}</Text>
                  <div>
                    <Text type="secondary">{item.status || 'Draft'} {item.classId ? `- ${item.classId}` : ''}</Text>
                  </div>
                </div>
                <Space wrap>
                  {String(item.status || 'DRAFT').toUpperCase() === 'DRAFT' ? (
                    <>
                      <Button size="small" onClick={() => setDraft(item)}>Edit</Button>
                      <Button size="small" type="primary" onClick={() => { setDraft(item); setPublishOpen(true); }}>Publish</Button>
                      <Button size="small" danger onClick={() => deleteDraft(item)}>Delete</Button>
                    </>
                  ) : (
                    <Tag color="green">Published - read only</Tag>
                  )}
                </Space>
              </div>
            ))}
          </div>
        ) : (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No quiz assignments yet" />
        )}
      </Card>

      <Modal
        title="Publish quiz assignment"
        open={publishOpen}
        onCancel={() => setPublishOpen(false)}
        onOk={publishDraft}
        okButtonProps={{ disabled: publishTarget === 'SELECTED_STUDENTS' && selectedStudents.length === 0 }}
      >
        <Space direction="vertical" style={{ width: '100%' }}>
          <Select
            value={publishTarget}
            onChange={setPublishTarget}
            options={[
              { value: 'CLASS', label: 'Entire class' },
              { value: 'SELECTED_STUDENTS', label: 'Selected students' },
            ]}
          />
          {publishTarget === 'SELECTED_STUDENTS' && (
            <Select
              mode="multiple"
              value={selectedStudents}
              onChange={setSelectedStudents}
              placeholder="Choose students"
              options={(teacherStudents || []).map((student) => ({
                value: student.id || student.studentId,
                label: [getPersonDisplayName(student, 'Student'), getPersonEmail(student)].filter(Boolean).join(' · '),
              }))}
            />
          )}
        </Space>
      </Modal>
    </div>
  );
}

export default QuizAssignments;
