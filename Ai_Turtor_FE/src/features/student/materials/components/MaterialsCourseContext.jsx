import { BookOutlined, InfoCircleOutlined, TeamOutlined } from '@ant-design/icons';
import { Select, Tag, Typography } from 'antd';

const { Text } = Typography;

export default function MaterialsCourseContext({
  courseId,
  classId,
  courseOptions = [],
  loading,
  onCourseChange,
  scopeTitle = 'Phạm vi học liệu',
  scopeDescription = 'Chọn môn học để xem đúng nội dung của lớp.',
  hint = 'Nội dung được lọc theo giảng viên phụ trách lớp này.',
  selectAriaLabel = 'Môn học của tài liệu',
  icon = <BookOutlined />,
}) {
  return (
    <div className="student-materials-context" role="region" aria-label="Ngữ cảnh môn học của sinh viên">
      <div className="student-materials-context__intro">
        <span className="student-materials-context__intro-icon" aria-hidden="true">
          {icon}
        </span>
        <div>
          <Text strong>{scopeTitle}</Text>
          <Text type="secondary">{scopeDescription}</Text>
        </div>
      </div>
      <div className="student-materials-context__field">
        <Text type="secondary" className="student-materials-context__label">Môn học</Text>
        <Select
          aria-label={selectAriaLabel}
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
        <Text type="secondary" className="student-materials-context__label">Lớp đã đăng ký</Text>
        <Tag color={classId ? 'blue' : 'default'} icon={<TeamOutlined />}>
          {classId || 'Chưa được xếp lớp'}
        </Tag>
      </div>
      <div className="student-materials-context__hint">
        <InfoCircleOutlined aria-hidden="true" />
        <Text type="secondary">{hint}</Text>
      </div>
    </div>
  );
}
