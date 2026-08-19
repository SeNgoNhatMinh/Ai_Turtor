import { Alert, Button, Col, Form, Input, Row, Select } from 'antd';
import { Send } from 'lucide-react';

export default function GoldQaContributionForm({
  form,
  disabled,
  pendingAction,
  userId,
  onFinish,
}) {
  return (
    <Form
      form={form}
      layout="vertical"
      disabled={disabled}
      initialValues={{ difficulty: 'MEDIUM' }}
      onFinish={onFinish}
    >
      <Row gutter={12}>
        <Col xs={24} md={16}>
          <Form.Item label="Chương" name="chapter" rules={[{ required: true, whitespace: true }]}>
            <Input readOnly maxLength={255} title="Khóa theo việc Senior đã bắt đầu" />
          </Form.Item>
        </Col>
        <Col xs={24} md={8}>
          <Form.Item label="Độ khó" name="difficulty" rules={[{ required: true }]}>
            <Select options={[
              { value: 'EASY', label: 'Dễ' },
              { value: 'MEDIUM', label: 'Trung bình' },
              { value: 'HARD', label: 'Khó' },
            ]} />
          </Form.Item>
        </Col>
      </Row>
      <Form.Item label="Câu hỏi vàng" name="question" rules={[{ required: true, whitespace: true }]}>
        <Input.TextArea rows={3} maxLength={5000} placeholder="Câu hỏi theo đúng chương giáo trình..." />
      </Form.Item>
      <Form.Item label="Đáp án vàng" name="goldAnswer" rules={[{ required: true, whitespace: true }]}>
        <Input.TextArea rows={7} maxLength={5000} placeholder="Đáp án ngắn, đúng sách..." />
      </Form.Item>
      <Alert
        type="info"
        showIcon
        title="Chưa vào RAG"
        description="Sau khi gửi, hệ thống hỏi AI bằng giáo trình đã embed rồi gửi bài thi cho Senior. Senior mới quyết định nạp vào RAG."
      />
      <div className="expert-training__form-actions">
        <Button
          type="primary"
          htmlType="submit"
          icon={<Send size={16} />}
          loading={pendingAction === 'submit-gold-qa'}
          disabled={Boolean(pendingAction) || !userId || disabled}
        >
          Gửi và chấm thi
        </Button>
      </div>
    </Form>
  );
}
