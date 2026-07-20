import { useEffect, useState } from 'react';
import {
  Alert,
  Button,
  Card,
  Col,
  Form,
  Input,
  InputNumber,
  Row,
  Select,
  Space,
  Tabs,
  Typography,
} from 'antd';
import { Plus, Send, Trash2 } from 'lucide-react';
import { getStatusLabel } from '../../../utils/statusLabels';
import {
  criteriaRowsToWeights,
  getTaskGoldUsage,
  validateCriteriaWeights,
} from '../expertTrainingUtils';

const { Paragraph, Text } = Typography;

const defaultCriteria = [
  { name: 'accuracy', weight: 0.6 },
  { name: 'groundedness', weight: 0.3 },
  { name: 'guidance', weight: 0.1 },
];

export default function ContributionWorkspace({
  selectedTask,
  userId,
  pendingAction,
  onSubmitGoldQa,
  onSubmitRubric,
}) {
  const [editorType, setEditorType] = useState(selectedTask?.type === 'RUBRIC' ? 'RUBRIC' : 'GOLD_QA');
  const [goldForm] = Form.useForm();
  const [rubricForm] = Form.useForm();
  const taskGoldUsage = getTaskGoldUsage(selectedTask);

  useEffect(() => {
    if (!selectedTask) return;
    const nextType = selectedTask.type === 'RUBRIC' ? 'RUBRIC' : 'GOLD_QA';
    if (nextType === 'GOLD_QA') {
      goldForm.setFieldsValue({
        chapter: selectedTask.chapter,
        usage: taskGoldUsage || 'TRAINING',
        difficulty: 'MEDIUM',
      });
    } else {
      rubricForm.setFieldsValue({
        chapter: selectedTask.chapter,
        name: selectedTask.title,
        description: selectedTask.instructions,
        criteria: defaultCriteria,
      });
    }
  }, [goldForm, rubricForm, selectedTask, taskGoldUsage]);

  const canSubmitSelectedTask = !selectedTask || ['ASSIGNED', 'IN_PROGRESS'].includes(selectedTask.status);

  const submitGold = async (values) => {
    if (taskGoldUsage && values.usage !== taskGoldUsage) {
      goldForm.setFields([{ name: 'usage', errors: [`Công việc này yêu cầu mục đích ${taskGoldUsage}.`] }]);
      return;
    }
    const result = await onSubmitGoldQa({
      ...values,
      sourceTaskId: selectedTask?.type === 'GOLD_QA' ? selectedTask.id : undefined,
    });
    if (result) {
      goldForm.resetFields();
      goldForm.setFieldsValue({ difficulty: 'MEDIUM', usage: 'TRAINING' });
    }
  };

  const submitRubric = async (values) => {
    const weightError = validateCriteriaWeights(values.criteria);
    if (weightError) {
      rubricForm.setFields([{ name: 'criteria', errors: [weightError] }]);
      return;
    }
    const result = await onSubmitRubric({
      chapter: values.chapter,
      name: values.name,
      description: values.description,
      criteriaWeights: criteriaRowsToWeights(values.criteria),
      sourceTaskId: selectedTask?.type === 'RUBRIC' ? selectedTask.id : undefined,
    });
    if (result) {
      rubricForm.resetFields();
      rubricForm.setFieldsValue({ criteria: defaultCriteria });
    }
  };

  const editorItems = [
    {
      key: 'GOLD_QA',
      label: 'Gold Q&A',
      children: (
        <Form
          form={goldForm}
          layout="vertical"
          disabled={!canSubmitSelectedTask}
          initialValues={{ difficulty: 'MEDIUM', usage: 'TRAINING' }}
          onFinish={submitGold}
        >
          <Row gutter={12}>
            <Col xs={24} md={14}>
              <Form.Item label="Chương" name="chapter" rules={[{ required: true, whitespace: true }]}>
                <Input maxLength={255} />
              </Form.Item>
            </Col>
            <Col xs={12} md={5}>
              <Form.Item label="Độ khó" name="difficulty" rules={[{ required: true }]}>
                <Select options={[
                  { value: 'EASY', label: 'Dễ' },
                  { value: 'MEDIUM', label: 'Trung bình' },
                  { value: 'HARD', label: 'Khó' },
                ]} />
              </Form.Item>
            </Col>
            <Col xs={12} md={5}>
              <Form.Item label="Mục đích" name="usage" rules={[{ required: true }]}>
                <Select disabled={Boolean(taskGoldUsage)} options={[
                  { value: 'TRAINING', label: 'Training' },
                  { value: 'EVALUATION', label: 'Evaluation holdout' },
                ]} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item label="Câu hỏi chuẩn" name="question" rules={[{ required: true, whitespace: true }]}>
            <Input.TextArea rows={3} maxLength={5000} />
          </Form.Item>
          <Form.Item label="Gold Answer" name="goldAnswer" rules={[{ required: true, whitespace: true }]}>
            <Input.TextArea rows={7} maxLength={5000} />
          </Form.Item>
          <Alert
            type="info"
            showIcon
            title="Training và Evaluation được tách biệt"
            description={taskGoldUsage
              ? `Task này yêu cầu ${taskGoldUsage}. TRAINING đã duyệt được index vào RAG; EVALUATION được giữ riêng làm holdout.`
              : 'TRAINING đã duyệt được index vào RAG. EVALUATION được giữ riêng làm holdout và không bao giờ được index.'}
          />
          <div className="expert-training__form-actions">
            <Button
              type="primary"
              htmlType="submit"
              icon={<Send size={16} />}
              loading={pendingAction === 'submit-gold-qa'}
              disabled={Boolean(pendingAction) || !userId}
            >
              Gửi kiểm duyệt
            </Button>
          </div>
        </Form>
      ),
    },
    {
      key: 'RUBRIC',
      label: 'Rubric',
      children: (
        <Form
          form={rubricForm}
          layout="vertical"
          disabled={!canSubmitSelectedTask}
          initialValues={{ criteria: defaultCriteria }}
          onFinish={submitRubric}
        >
          <Row gutter={12}>
            <Col xs={24} md={10}>
              <Form.Item label="Chương" name="chapter" rules={[{ required: true, whitespace: true }]}>
                <Input maxLength={255} />
              </Form.Item>
            </Col>
            <Col xs={24} md={14}>
              <Form.Item label="Tên Rubric" name="name" rules={[{ required: true, whitespace: true }]}>
                <Input maxLength={255} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item label="Mô tả" name="description">
            <Input.TextArea rows={3} maxLength={5000} />
          </Form.Item>
          <Form.List name="criteria">
            {(fields, { add, remove }) => (
              <Form.Item label="Trọng số tiêu chí" required>
                <div className="expert-training__criteria-list">
                  {fields.map((field) => (
                    <Space key={field.key} align="start" className="expert-training__criteria-row">
                      <Form.Item
                        {...field}
                        name={[field.name, 'name']}
                        rules={[{ required: true, whitespace: true, message: 'Tên tiêu chí là bắt buộc.' }]}
                      >
                        <Input placeholder="accuracy" maxLength={80} />
                      </Form.Item>
                      <Form.Item
                        {...field}
                        name={[field.name, 'weight']}
                        rules={[{ required: true, message: 'Trọng số là bắt buộc.' }]}
                      >
                        <InputNumber min={0.001} max={1} step={0.05} precision={3} placeholder="0.6" />
                      </Form.Item>
                      <Button
                        type="text"
                        danger
                        icon={<Trash2 size={16} />}
                        aria-label="Xóa tiêu chí"
                        onClick={() => remove(field.name)}
                        disabled={fields.length <= 1}
                      />
                    </Space>
                  ))}
                  <Button icon={<Plus size={16} />} onClick={() => add({ name: '', weight: 0.1 })}>
                    Thêm tiêu chí
                  </Button>
                </div>
              </Form.Item>
            )}
          </Form.List>
          <Text type="secondary">Backend chỉ chấp nhận Rubric khi tổng trọng số bằng đúng 1.0.</Text>
          <div className="expert-training__form-actions">
            <Button
              type="primary"
              htmlType="submit"
              icon={<Send size={16} />}
              loading={pendingAction === 'submit-rubric'}
              disabled={Boolean(pendingAction) || !userId}
            >
              Gửi kiểm duyệt
            </Button>
          </div>
        </Form>
      ),
    },
  ];

  return (
    <section className="expert-training__section" aria-labelledby="contributions-heading">
      <div className="expert-training__section-heading">
        <div>
          <h2 id="contributions-heading">Soạn nội dung đóng góp</h2>
          <p>Nội dung chỉ được sử dụng sau khi Senior Mentor hoặc Admin kiểm duyệt.</p>
        </div>
      </div>

      {selectedTask && (
        <Alert
          type={selectedTask.status === 'SUBMITTED' ? 'success' : 'info'}
          showIcon
          title={`Đang thực hiện: ${selectedTask.title}`}
          description={`${selectedTask.chapter} · ${getStatusLabel(selectedTask.status)}${selectedTask.instructions ? ` · ${selectedTask.instructions}` : ''}`}
        />
      )}

      <Card className="expert-training__editor-card" title="Chuẩn bị nội dung">
        <Tabs
          activeKey={selectedTask ? (selectedTask.type === 'RUBRIC' ? 'RUBRIC' : 'GOLD_QA') : editorType}
          onChange={setEditorType}
          items={editorItems}
        />
      </Card>

      <Paragraph type="secondary" className="expert-training__policy-note">
        Nội dung đã nộp chưa phải tri thức AI. Chỉ TRAINING Gold Q&A được phê duyệt mới được index vào RAG của môn học.
      </Paragraph>
    </section>
  );
}
