import { Alert, Col, Form, Input, Row, Select } from 'antd';
import { Save, Sparkles, X } from 'lucide-react';
import ActionButton from '../../../../components/common/ActionButton';

export default function GoldQaContributionForm({
  form,
  disabled,
  pendingAction,
  userId,
  onFinish,
  onExam,
  onCancel,
  submitLabel = 'Lưu vào danh sách',
  examLabel = 'Cho AI thi',
  showCancel = false,
  showExam = true,
}) {
  const examing = String(pendingAction || '').startsWith('exam-gold-qa:')
    || pendingAction === 'submit-gold-qa';

  const runExam = () => {
    form.validateFields().then((values) => onExam?.(values));
  };

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
        extra="Mỗi ý một dòng. Chỉ liệt kê ý đã có trong sách; giáo trình là chuẩn duy nhất."
        rules={[{ required: true, whitespace: true }]}
      >
        <Input.TextArea
          rows={6}
          maxLength={5000}
          showCount
          placeholder={'Ví dụ (mỗi ý một dòng):\n- JSPX là dạng XML của JSP, đuôi .jspx\n- Dễ phát hiện lỗi lúc compile hơn runtime'}
        />
      </Form.Item>
      <Alert
        type="info"
        showIcon
        title="Lưu list hoặc cho AI thi ngay trên form này"
        description="Lưu = nháp. Cho AI thi trên form = lần 1. Sau đó trên list còn 1 lượt thi lại (gộp ý GV). Senior từ chối mới reset 2 lượt."
      />
      <div className="expert-training__form-actions">
        {showCancel && (
          <ActionButton icon={<X size={16} />} onClick={onCancel} disabled={Boolean(pendingAction)}>
            Hủy
          </ActionButton>
        )}
        <ActionButton
          htmlType="submit"
          icon={<Save size={16} />}
          loading={pendingAction === 'save-gold-draft'}
          disabled={Boolean(pendingAction) || !userId || disabled}
        >
          {submitLabel}
        </ActionButton>
        {showExam && (
          <ActionButton
            intent="primary"
            htmlType="button"
            icon={<Sparkles size={16} />}
            loading={examing}
            disabled={Boolean(pendingAction) || !userId || disabled}
            onClick={runExam}
          >
            {examLabel}
          </ActionButton>
        )}
      </div>
    </Form>
  );
}
