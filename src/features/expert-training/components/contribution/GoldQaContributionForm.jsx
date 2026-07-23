import { Alert, Button, Col, Form, Input, Row, Select } from 'antd';
import { Send } from 'lucide-react';

export default function GoldQaContributionForm({
  form,
  disabled,
  taskUsage,
  pendingAction,
  userId,
  onFinish,
}) {
  return (
    <Form
      form={form}
      layout="vertical"
      disabled={disabled}
      initialValues={{ difficulty: 'MEDIUM', usage: 'TRAINING' }}
      onFinish={onFinish}
    >
      <Row gutter={12}>
        <Col xs={24} md={14}>
          <Form.Item label="Chương" name="chapter" rules={[{ required: true, whitespace: true }]}>
            <Input readOnly maxLength={255} title="Chapter được khóa theo công việc đã nhận" />
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
            <Input readOnly title="Mục đích được khóa theo task do Senior/Admin tạo" />
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
        description={taskUsage
          ? `Task này yêu cầu ${taskUsage}. TRAINING đã duyệt được index vào RAG; EVALUATION được giữ riêng làm holdout.`
          : 'TRAINING đã duyệt được index vào RAG. EVALUATION được giữ riêng làm holdout và không bao giờ được index.'}
      />
      <div className="expert-training__form-actions">
        <Button
          type="primary"
          htmlType="submit"
          icon={<Send size={16} />}
          loading={pendingAction === 'submit-gold-qa'}
          disabled={Boolean(pendingAction) || !userId || disabled}
        >
          Gửi kiểm duyệt
        </Button>
      </div>
    </Form>
  );
}
