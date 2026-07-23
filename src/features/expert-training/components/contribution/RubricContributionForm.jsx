import {
  Button,
  Col,
  Form,
  Input,
  InputNumber,
  Row,
  Space,
  Typography,
} from 'antd';
import { Plus, Send, Trash2 } from 'lucide-react';
import { DEFAULT_RUBRIC_CRITERIA } from './contributionDefaults';

const { Text } = Typography;

export default function RubricContributionForm({
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
      initialValues={{ criteria: DEFAULT_RUBRIC_CRITERIA }}
      onFinish={onFinish}
    >
      <Row gutter={12}>
        <Col xs={24} md={10}>
          <Form.Item label="Chương" name="chapter" rules={[{ required: true, whitespace: true }]}>
            <Input readOnly maxLength={255} title="Chapter được khóa theo công việc đã nhận" />
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
              {fields.map(({ key, ...field }) => (
                <Space key={key} align="start" className="expert-training__criteria-row">
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
          disabled={Boolean(pendingAction) || !userId || disabled}
        >
          Gửi kiểm duyệt
        </Button>
      </div>
    </Form>
  );
}
