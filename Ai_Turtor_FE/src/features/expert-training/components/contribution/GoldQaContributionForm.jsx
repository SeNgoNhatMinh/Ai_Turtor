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
        label="Câu hỏi (theo chương giáo trình)"
        name="question"
        extra="Viết câu sinh viên hay hỏi trong phạm vi chương — bám mục lục/sách đã hiển thị."
        rules={[{ required: true, whitespace: true }]}
      >
        <Input.TextArea rows={3} maxLength={5000} showCount placeholder="Ví dụ: Vòng đời Servlet gồm những giai đoạn nào?" />
      </Form.Item>
      <Form.Item
        label="Tóm tắt ý chính từ giáo trình"
        name="goldAnswer"
        extra="Mỗi ý một dòng (hoặc gạch đầu dòng -). Chỉ liệt kê/diễn đạt lại ý đã có trong sách; giáo trình là chuẩn duy nhất."
        rules={[{ required: true, whitespace: true }]}
      >
        <Input.TextArea
          rows={8}
          maxLength={5000}
          showCount
          placeholder={'Ví dụ (mỗi ý một dòng):\n- JSPX là dạng XML của JSP, đuôi .jspx\n- Dễ phát hiện lỗi lúc compile hơn runtime\n- Ít phổ biến hơn JSP thường'}
        />
      </Form.Item>
      <Alert
        type="info"
        showIcon
        title="Giáo trình là chuẩn — chấm = xem trước câu SV sau training"
        description="Lưu/Thi lại sẽ hỏi AI bằng sách + tóm tắt của bạn (chưa nạp RAG). Khi thấy câu đủ ý mới Gửi Senior — Senior chỉ duyệt nạp, không phải bước làm AI tốt hơn."
      />
      <div className="expert-training__form-actions">
        <ActionButton
          intent="primary"
          htmlType="submit"
          icon={<Send size={16} />}
          loading={pendingAction === 'submit-gold-qa'}
          disabled={Boolean(pendingAction) || !userId || disabled}
        >
          Lưu và xem trước câu SV
        </ActionButton>
      </div>
    </Form>
  );
}
