import { useEffect, useMemo, useState } from 'react';
import { Alert, Button, Card, Form, Input, Radio, Select, Space, Tag, Tooltip, Typography } from 'antd';
import { Plus, Trash2 } from 'lucide-react';
import {
  buildQuizDraftPayload,
  createDraftQuestion,
  createEmptyDraftQuestion,
  QUIZ_QUESTION_TYPES,
  setDraftQuestionType,
  updateDraftOption,
  validateQuizDraft,
} from '../../features/teacher/quizzes/quizDraftUtils';

const { Text } = Typography;

function QuizDraftEditor({ draft, onSave, onStateChange, saving = false, readOnly = false }) {
  const [form] = Form.useForm();
  const [questions, setQuestions] = useState([]);
  const [dirty, setDirty] = useState(false);
  const validation = useMemo(() => validateQuizDraft(questions), [questions]);

  useEffect(() => {
    const syncTimer = window.setTimeout(() => {
      form.setFieldsValue({
        title: draft?.title || '',
        topic: draft?.topic || '',
        suggestionText: draft?.suggestionText || '',
      });
      setQuestions((draft?.questions || []).map(createDraftQuestion));
      setDirty(false);
    }, 0);
    return () => window.clearTimeout(syncTimer);
  }, [draft, form]);

  useEffect(() => {
    onStateChange?.({ dirty, valid: validation.valid });
  }, [dirty, onStateChange, validation.valid]);

  const markDirty = () => {
    if (!readOnly) setDirty(true);
  };

  const updateQuestion = (index, patch) => {
    setQuestions((current) => current.map((question, idx) => idx === index ? { ...question, ...patch } : question));
    markDirty();
  };

  const updateOption = (questionIndex, optionIndex, value) => {
    setQuestions((current) => current.map((question, idx) => {
      if (idx !== questionIndex) return question;
      return updateDraftOption(question, optionIndex, value);
    }));
    markDirty();
  };

  const changeQuestionType = (index, type) => {
    setQuestions((current) => current.map((question, idx) => (
      idx === index ? setDraftQuestionType(question, type) : question
    )));
    markDirty();
  };

  const addOption = (questionIndex) => {
    setQuestions((current) => current.map((question, index) => (
      index === questionIndex ? { ...question, options: [...question.options, ''] } : question
    )));
    markDirty();
  };

  const removeOption = (questionIndex, optionIndex) => {
    setQuestions((current) => current.map((question, index) => {
      if (index !== questionIndex || question.options.length <= 2) return question;
      const removedOption = question.options[optionIndex];
      const options = question.options.filter((_, idx) => idx !== optionIndex);
      return {
        ...question,
        options,
        correctAnswer: String(question.correctAnswer).trim().toLocaleLowerCase()
          === String(removedOption).trim().toLocaleLowerCase()
          ? ''
          : question.correctAnswer,
      };
    }));
    markDirty();
  };

  const addQuestion = () => {
    setQuestions((current) => [...current, createEmptyDraftQuestion()]);
    markDirty();
  };

  const removeQuestion = (index) => {
    if (questions.length <= 1) return;
    setQuestions((current) => current.filter((_, idx) => idx !== index));
    markDirty();
  };

  const save = async () => {
    const values = await form.validateFields();
    if (!validation.valid) return;
    const result = await onSave?.(buildQuizDraftPayload(values, questions));
    if (result) setDirty(false);
  };

  if (!draft) return null;

  const gradingMode = String(draft.gradingMode || 'AUTO').toUpperCase();
  const isTeacherManual = gradingMode === 'TEACHER_MANUAL';
  const isAiAssisted = gradingMode === 'AI_ASSISTED';

  return (
    <Card
      className="quiz-card quiz-draft-editor"
      title={readOnly ? 'Quiz đã xuất bản' : 'Chỉnh sửa draft'}
      extra={readOnly
        ? <Tag color="green">Đã xuất bản · Chỉ xem</Tag>
        : <Tag color={dirty ? 'gold' : 'green'}>{dirty ? 'Có thay đổi chưa lưu' : 'Đã lưu'}</Tag>}
    >
      <Space orientation="vertical" size={16} style={{ width: '100%' }}>
        {!readOnly && (
          <Alert
            type="info"
            showIcon
            title={isTeacherManual || isAiAssisted ? 'Quiz trực tuyến · Giảng viên cần kiểm tra draft' : 'Draft do AI tạo · Giảng viên cần kiểm tra'}
            description={isTeacherManual
              ? 'Chế độ giảng viên chấm chỉ lưu lựa chọn của sinh viên. Answer key không được hiển thị cho sinh viên.'
              : isAiAssisted
                ? 'AI hỗ trợ đưa điểm gợi ý từ answer key đã lưu. Giảng viên kiểm tra và xác nhận điểm cuối cùng.'
                : 'Kiểm tra từng câu và chọn answer key chính thức trước khi xuất bản. Backend chấm theo đáp án đã lưu.'}
          />
        )}
        <div className="quiz-draft-mode-summary">
          <Text className="quiz-draft-field-label">Chế độ chấm</Text>
          <Tag color={isTeacherManual ? 'blue' : isAiAssisted ? 'purple' : 'default'}>
            {isTeacherManual ? 'Giảng viên chấm' : isAiAssisted ? 'AI hỗ trợ chấm' : 'Backend tự chấm'}
          </Tag>
        </div>
        <Form form={form} layout="vertical" disabled={readOnly} onValuesChange={markDirty}>
          <Form.Item name="title" label="Tên quiz" rules={[{ required: true, message: 'Nhập tên quiz' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="topic" label="Chủ đề">
            <Input />
          </Form.Item>
          <Form.Item name="suggestionText" label="Gợi ý / mục tiêu học tập">
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>

        {questions.map((question, index) => (
          <div key={question.questionId} className="quiz-question-block quiz-draft-question">
            <div className="quiz-draft-question-header">
              <div>
                <Text strong>Câu {index + 1}</Text>
                <Tag>{question.type === QUIZ_QUESTION_TYPES.TRUE_FALSE ? 'Đúng / Sai' : 'Trắc nghiệm'}</Tag>
              </div>
              {!readOnly && (
                <Tooltip title={questions.length <= 1 ? 'Quiz cần ít nhất một câu hỏi' : 'Xóa câu hỏi'}>
                  <Button
                    type="text"
                    danger
                    icon={<Trash2 size={16} />}
                    disabled={questions.length <= 1}
                    aria-label={`Xóa câu hỏi ${index + 1}`}
                    onClick={() => removeQuestion(index)}
                  />
                </Tooltip>
              )}
            </div>
            <Select
              value={question.type}
              disabled={readOnly}
              aria-label={`Loại câu hỏi ${index + 1}`}
              onChange={(type) => changeQuestionType(index, type)}
              options={[
                { value: QUIZ_QUESTION_TYPES.MULTIPLE_CHOICE, label: 'Trắc nghiệm' },
                { value: QUIZ_QUESTION_TYPES.TRUE_FALSE, label: 'Đúng / Sai' },
              ]}
              style={{ width: '100%', marginTop: 10 }}
            />
            <Input
              value={question.questionText}
              disabled={readOnly}
              onChange={(event) => updateQuestion(index, { questionText: event.target.value })}
              placeholder="Nội dung câu hỏi"
              style={{ marginTop: 8, marginBottom: 8 }}
            />
            <div className="quiz-draft-options">
              <Text className="quiz-draft-field-label">Các lựa chọn</Text>
              {question.options.map((option, optionIndex) => (
                <div className="quiz-draft-option-row" key={`${question.questionId}-${optionIndex}`}>
                  <Input
                    value={option}
                    disabled={readOnly || question.type === QUIZ_QUESTION_TYPES.TRUE_FALSE}
                    onChange={(event) => updateOption(index, optionIndex, event.target.value)}
                    placeholder={`Lựa chọn ${optionIndex + 1}`}
                  />
                  {!readOnly && question.type !== QUIZ_QUESTION_TYPES.TRUE_FALSE && (
                    <Tooltip title={question.options.length <= 2 ? 'Giữ ít nhất hai lựa chọn' : 'Xóa lựa chọn'}>
                      <Button
                        type="text"
                        danger
                        icon={<Trash2 size={15} />}
                        disabled={question.options.length <= 2}
                        aria-label={`Xóa lựa chọn ${optionIndex + 1} khỏi câu ${index + 1}`}
                        onClick={() => removeOption(index, optionIndex)}
                      />
                    </Tooltip>
                  )}
                </div>
              ))}
              {!readOnly && question.type !== QUIZ_QUESTION_TYPES.TRUE_FALSE && (
                <Button type="dashed" icon={<Plus size={15} />} onClick={() => addOption(index)}>Thêm lựa chọn</Button>
              )}
            </div>
            <div className="quiz-draft-answer-key">
              <Text className="quiz-draft-field-label">Đáp án đúng</Text>
              <Radio.Group
                value={question.correctAnswer}
                disabled={readOnly}
                onChange={(event) => updateQuestion(index, { correctAnswer: event.target.value })}
              >
                <Space orientation="vertical">
                  {question.options.map((option, optionIndex) => (
                    <Radio key={`${question.questionId}-answer-${optionIndex}`} value={option} disabled={readOnly || !option.trim()}>
                      {option.trim() || `Lựa chọn ${optionIndex + 1} đang trống`}
                    </Radio>
                  ))}
                </Space>
              </Radio.Group>
            </div>
            <Input.TextArea
              value={question.explanation}
              disabled={readOnly}
              onChange={(event) => updateQuestion(index, { explanation: event.target.value })}
              placeholder="Giải thích đáp án"
              rows={2}
              style={{ marginTop: 8 }}
            />
            {validation.questionErrors[index]?.length > 0 && !readOnly && (
              <Alert
                className="quiz-draft-validation"
                type="error"
                showIcon
                title="Sửa câu hỏi này trước khi lưu"
                description={validation.questionErrors[index].join(' ')}
              />
            )}
          </div>
        ))}

        {!readOnly && (
          <div className="quiz-draft-actions">
            <Button icon={<Plus size={16} />} onClick={addQuestion}>Thêm câu hỏi</Button>
            <Button type="primary" loading={saving} disabled={!dirty || !validation.valid} onClick={save}>Lưu draft</Button>
          </div>
        )}
      </Space>
    </Card>
  );
}

export default QuizDraftEditor;
