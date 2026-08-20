import { Alert, Col, Form, Input, Row, Select } from 'antd';
import { Send } from 'lucide-react';
import ActionButton from '../../../../components/common/ActionButton';

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
      <Form.Item
        label="Câu hỏi vàng"
        name="question"
        extra="Viết một câu hỏi cụ thể mà sinh viên có thể hỏi trong phạm vi chương này."
        rules={[{ required: true, whitespace: true }]}
      >
        <Input.TextArea rows={3} maxLength={5000} showCount placeholder="Ví dụ: Đệ quy là gì và điều kiện dừng có vai trò gì?" />
      </Form.Item>
      <Form.Item
        label="Đáp án chuẩn theo giáo trình"
        name="goldAnswer"
        extra="Trả lời đủ ý, không bổ sung kiến thức ngoài phần tài liệu hiển thị bên cạnh."
        rules={[{ required: true, whitespace: true }]}
      >
        <Input.TextArea rows={8} maxLength={5000} showCount placeholder="Viết đáp án chuẩn, rõ ràng và bám sát giáo trình..." />
      </Form.Item>
      <Alert
        type="info"
        showIcon
        title="Gửi bài không đồng nghĩa AI đã học"
        description="Backend sẽ hỏi AI bằng giáo trình cũ, tính điểm bài thi rồi chuyển đáp án Teacher và đáp án AI sang Senior."
      />
      <div className="expert-training__form-actions">
        <ActionButton
          intent="primary"
          htmlType="submit"
          icon={<Send size={16} />}
          loading={pendingAction === 'submit-gold-qa'}
          disabled={Boolean(pendingAction) || !userId || disabled}
        >
          Nộp Q&A và chấm bằng sách
        </ActionButton>
      </div>
    </Form>
  );
}
