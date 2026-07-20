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
    throw new Error('Nội dung câu hỏi phải là JSON hợp lệ.');
  }

  const rawQuestions = Array.isArray(parsed) ? parsed : parsed?.questions;
  if (!Array.isArray(rawQuestions) || rawQuestions.length === 0) {
    throw new Error('JSON phải chứa mảng questions có ít nhất một câu hỏi.');
  }

  const questions = rawQuestions.map((question, index) => createDraftQuestion(question, index));
  const validation = validateQuizDraft(questions);
  if (!validation.valid) {
    const firstError = validation.questionErrors.find((errors) => errors.length)?.[0];
    throw new Error(firstError || validation.generalError || 'Kiểm tra dữ liệu câu hỏi trước khi tạo quiz.');
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
      ? 'Backend đưa điểm gợi ý từ answer key. Giảng viên xác nhận điểm cuối cùng.'
      : 'Backend chỉ lưu lựa chọn của sinh viên. Giảng viên nhập điểm sau khi sinh viên nộp.'
  ), [gradingMode]);

  const handleImport = async (file) => {
    try {
      setQuestionsJson(await file.text());
      setFormError('');
    } catch {
      setFormError('Không thể đọc tệp JSON này.');
    }
    return false;
  };

  const createQuiz = async (values) => {
    setFormError('');
    if (!teacherId || !courseId || !classId) {
      setFormError('Chọn lớp học phần trước khi tạo quiz trực tuyến.');
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
      const message = getUserFacingError(error, 'Không thể tạo quiz trực tuyến.');
      setFormError(message);
      triggerToast?.(message);
    } finally {
      setCreating(false);
    }
  };

  return (
    <Space orientation="vertical" size={12} style={{ width: '100%' }}>
      <Text type="secondary">
        Tạo quiz do giảng viên biên soạn. Có thể nhập template JSON rồi chỉnh sửa draft trước khi xuất bản.
      </Text>
      {formError && <Alert type="error" showIcon title={formError} />}
      <Form
        form={form}
        layout="vertical"
        initialValues={{ gradingMode: 'TEACHER_MANUAL' }}
        onFinish={createQuiz}
        disabled={disabled || creating}
      >
        <Form.Item name="title" label="Tên quiz" rules={[{ required: true, message: 'Nhập tên quiz' }]}>
          <Input placeholder="Ví dụ: Ôn tập giữa kỳ OOP" />
        </Form.Item>
        <Form.Item name="topic" label="Chủ đề">
          <Input placeholder="Ví dụ: Constructor và kế thừa" />
        </Form.Item>
        <Form.Item name="gradingMode" label="Chế độ chấm">
          <Select options={[
            { value: 'TEACHER_MANUAL', label: 'Giảng viên chấm · Nhập điểm cuối cùng' },
            { value: 'AI_ASSISTED', label: 'AI hỗ trợ · Backend đưa điểm gợi ý' },
          ]} />
        </Form.Item>
        <Alert type="info" showIcon title={modeDescription} style={{ marginBottom: 12 }} />
        <Form.Item label="JSON câu hỏi" required>
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
            <Button icon={<UploadOutlined />} disabled={disabled || creating}>Nhập JSON</Button>
          </Upload>
          <Button type="primary" htmlType="submit" loading={creating} disabled={disabled || !courseId || !classId}>
            Tạo draft quiz trực tuyến
          </Button>
        </Space>
      </Form>
      {disabled && <Text type="warning">Chọn lớp học phần để tạo quiz đúng phạm vi.</Text>}
    </Space>
  );
}
