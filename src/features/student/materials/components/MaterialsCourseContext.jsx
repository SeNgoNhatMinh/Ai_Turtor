import { Select, Tag, Typography } from 'antd';

const { Text } = Typography;

export default function MaterialsCourseContext({
  courseId,
  classId,
  courseOptions,
  loading,
  onCourseChange,
}) {
  return (
    <div className="student-materials-context" role="region" aria-label="Ngữ cảnh môn học của bài tập">
      <div className="student-materials-context__field">
        <Text type="secondary">Môn học</Text>
        <Select
          aria-label="Môn học của bài tập"
          value={courseId || undefined}
          options={courseOptions}
          loading={loading}
          disabled={loading || courseOptions.length === 0}
          placeholder="Chọn môn học đã đăng ký"
          onChange={onCourseChange}
          style={{ minWidth: 260 }}
        />
      </div>
      <div className="student-materials-context__field student-materials-context__class">
        <Text type="secondary">Lớp đã đăng ký</Text>
        <Tag color={classId ? 'blue' : 'default'}>{classId || 'Chưa được xếp lớp'}</Tag>
      </div>
      <Text type="secondary" className="student-materials-context__hint">
        Bài tập và tài liệu bên dưới được lọc theo môn học này.
      </Text>
    </div>
  );
}
