import { Button, Card, DatePicker, Form, Input } from 'antd';
import { RefreshCw, Search } from 'lucide-react';

export default function AiLogFilters({ loading, onApply, onReset }) {
  const [form] = Form.useForm();

  const handleReset = () => {
    form.resetFields();
    onReset?.();
  };

  return (
    <Card className="admin-ai-logs-filter-card">
      <Form form={form} layout="vertical" onFinish={onApply} className="admin-ai-logs-filter-form">
        <div className="admin-ai-logs-filter-grid">
          <Form.Item name="q" label="Nội dung">
            <Input allowClear prefix={<Search size={15} />} placeholder="Tìm trong câu hỏi hoặc câu trả lời" />
          </Form.Item>
          <Form.Item name="studentId" label="Sinh viên">
            <Input allowClear placeholder="Nhập mã sinh viên" />
          </Form.Item>
          <Form.Item name="courseId" label="Môn học">
            <Input allowClear placeholder="Ví dụ: PRJ301" />
          </Form.Item>
          <Form.Item name="range" label="Khoảng thời gian" className="admin-ai-logs-date-field">
            <DatePicker.RangePicker showTime className="admin-ai-logs-range-picker" />
          </Form.Item>
        </div>
        <div className="admin-ai-logs-filter-actions">
          <Button icon={<RefreshCw size={15} />} disabled={loading} onClick={handleReset}>
            Làm mới
          </Button>
          <Button type="primary" htmlType="submit" icon={<Search size={15} />} loading={loading}>
            Áp dụng bộ lọc
          </Button>
        </div>
      </Form>
    </Card>
  );
}
