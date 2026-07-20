import { Button, Card, Form, Input, InputNumber, Select } from 'antd';
import TeacherOnlineQuizForm from '../../../../pages/teacher/TeacherOnlineQuizForm';

export default function QuizDraftCreationCards({
  form,
  classOptions,
  classesLoading,
  loading,
  teacherId,
  courseId,
  classId,
  onClassChange,
  onGenerate,
  onManualCreated,
  triggerToast,
}) {
  return (
    <div className="quiz-grid">
      <Card className="quiz-card" title="Tạo draft bằng AI">
        <Form
          form={form}
          layout="vertical"
          onFinish={onGenerate}
          initialValues={{ title: '', topic: '', suggestionText: '', questionCount: 5 }}
        >
          <Form.Item name="classId" label="Lớp học phần" rules={[{ required: true, message: 'Chọn lớp nhận quiz' }]}>
            <Select
              showSearch
              placeholder="Chọn lớp học phần"
              optionFilterProp="searchLabel"
              options={classOptions}
              loading={classesLoading}
              disabled={classesLoading || classOptions.length === 0}
              notFoundContent={classesLoading ? 'Đang tải lớp...' : 'Không có lớp được phân công'}
              onChange={onClassChange}
            />
          </Form.Item>
          <Form.Item name="title" label="Tên quiz" rules={[{ required: true, message: 'Nhập tên quiz' }]}>
            <Input placeholder="Ví dụ: Quiz ôn tập JPA PRJ301" />
          </Form.Item>
          <Form.Item name="topic" label="Chủ đề">
            <Input placeholder="Ví dụ: Quan hệ trong JPA" />
          </Form.Item>
          <Form.Item name="suggestionText" label="Mục tiêu học tập / gợi ý">
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item name="questionCount" label="Số câu hỏi">
            <InputNumber min={3} max={10} />
          </Form.Item>
          <Button type="primary" htmlType="submit" loading={loading}>Tạo draft quiz</Button>
        </Form>
      </Card>

      <Card className="quiz-card" title="Tạo quiz trực tuyến thủ công">
        <TeacherOnlineQuizForm
          teacherId={teacherId}
          courseId={courseId}
          classId={classId}
          disabled={!courseId || !classId}
          onCreated={onManualCreated}
          triggerToast={triggerToast}
        />
      </Card>
    </div>
  );
}
