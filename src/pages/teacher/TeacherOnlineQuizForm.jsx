import { useMemo, useState } from 'react';
import { Alert, Button, Form, Input, Select, Space, Typography, Upload } from 'antd';
import { UploadOutlined } from '@ant-design/icons';
import { getUserFacingError } from '../../services/apiClient';
import { quizApi } from '../../services/quizApi';
import {
  buildQuizDraftPayload,
  createDraftQuestion,
  validateQuizDraft,
} from '../../features/teacher/quizzes/quizDraftUtils';

const { Text } = Typography;

const SAMPLE_QUESTIONS = JSON.stringify([
  {
    questionId: 'Q1',
    type: 'MULTIPLE_CHOICE',
    questionText: 'Which HTTP method is normally used to create a resource?',
    options: ['GET', 'POST', 'PUT', 'DELETE'],
    correctAnswer: 'POST',
    explanation: 'POST is commonly used to create a subordinate resource.',
  },
], null, 2);

const readQuestions = (value) => {
  let parsed;
  try {
    parsed = JSON.parse(value);
  } catch {
    throw new Error('Questions must be valid JSON.');
  }

  const rawQuestions = Array.isArray(parsed) ? parsed : parsed?.questions;
  if (!Array.isArray(rawQuestions) || rawQuestions.length === 0) {
    throw new Error('JSON must contain a non-empty questions array.');
  }

  const questions = rawQuestions.map((question, index) => createDraftQuestion(question, index));
  const validation = validateQuizDraft(questions);
  if (!validation.valid) {
    const firstError = validation.questionErrors.find((errors) => errors.length)?.[0];
    throw new Error(firstError || validation.generalError || 'Review the question data before creating the quiz.');
  }
  return questions;
};

export default function TeacherOnlineQuizForm({
  teacherId,
  courseId,
  classId,
  disabled = false,
  onCreated,
  triggerToast,
}) {
  const [form] = Form.useForm();
  const [questionsJson, setQuestionsJson] = useState(SAMPLE_QUESTIONS);
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState('');
  const gradingMode = Form.useWatch('gradingMode', form) || 'TEACHER_MANUAL';
  const modeDescription = useMemo(() => (
    gradingMode === 'AI_ASSISTED'
      ? 'Backend will suggest a score from the answer key. The teacher confirms the final score.'
      : 'Backend stores student choices only. The teacher enters the final score after submission.'
  ), [gradingMode]);

  const handleImport = async (file) => {
    try {
      setQuestionsJson(await file.text());
      setFormError('');
    } catch {
      setFormError('Unable to read this JSON file.');
    }
    return false;
  };

  const createQuiz = async (values) => {
    setFormError('');
    if (!teacherId || !courseId || !classId) {
      setFormError('Choose a teaching class before creating an online quiz.');
      return;
    }

    let questions;
    try {
      questions = readQuestions(questionsJson);
    } catch (error) {
      setFormError(error.message);
      return;
    }

    setCreating(true);
    try {
      const assignment = await quizApi.createManualTeacherQuiz(teacherId, courseId, {
        classId,
        title: values.title.trim(),
        topic: values.topic?.trim() || '',
        gradingMode: values.gradingMode,
        questions: buildQuizDraftPayload(values, questions).questions,
      });
      onCreated?.(assignment);
      form.resetFields();
      setQuestionsJson(SAMPLE_QUESTIONS);
    } catch (error) {
      const message = getUserFacingError(error, 'Unable to create teacher online quiz.');
      setFormError(message);
      triggerToast?.(message);
    } finally {
      setCreating(false);
    }
  };

  return (
    <Space orientation="vertical" size={12} style={{ width: '100%' }}>
      <Text type="secondary">
        Create a teacher-authored quiz directly. Import the JSON template, then edit the saved draft before publishing.
      </Text>
      {formError && <Alert type="error" showIcon title={formError} />}
      <Form
        form={form}
        layout="vertical"
        initialValues={{ gradingMode: 'TEACHER_MANUAL' }}
        onFinish={createQuiz}
        disabled={disabled || creating}
      >
        <Form.Item name="title" label="Quiz title" rules={[{ required: true, message: 'Title is required' }]}>
          <Input placeholder="Example: OOP midterm review" />
        </Form.Item>
        <Form.Item name="topic" label="Topic">
          <Input placeholder="Example: Constructors and inheritance" />
        </Form.Item>
        <Form.Item name="gradingMode" label="Grading mode">
          <Select options={[
            { value: 'TEACHER_MANUAL', label: 'Teacher manual - teacher enters final score' },
            { value: 'AI_ASSISTED', label: 'AI assisted - backend suggests a score' },
          ]} />
        </Form.Item>
        <Alert type="info" showIcon message={modeDescription} style={{ marginBottom: 12 }} />
        <Form.Item label="Questions JSON" required>
          <Input.TextArea
            value={questionsJson}
            onChange={(event) => setQuestionsJson(event.target.value)}
            rows={7}
            placeholder={SAMPLE_QUESTIONS}
            spellCheck={false}
          />
        </Form.Item>
        <Space wrap>
          <Upload
            accept=".json,application/json"
            showUploadList={false}
            beforeUpload={handleImport}
          >
            <Button icon={<UploadOutlined />} disabled={disabled || creating}>Import JSON</Button>
          </Upload>
          <Button type="primary" htmlType="submit" loading={creating} disabled={disabled || !courseId || !classId}>
            Create online quiz draft
          </Button>
        </Space>
      </Form>
      {disabled && <Text type="warning">Choose a teaching class to create a class-scoped quiz.</Text>}
    </Space>
  );
}
