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
    <div className="student-materials-context" role="region" aria-label="Assignment course context">
      <div className="student-materials-context__field">
        <Text type="secondary">Course</Text>
        <Select
          aria-label="Assignment course"
          value={courseId || undefined}
          options={courseOptions}
          loading={loading}
          disabled={loading || courseOptions.length === 0}
          placeholder="Choose an enrolled course"
          onChange={onCourseChange}
          style={{ minWidth: 260 }}
        />
      </div>
      <div className="student-materials-context__field student-materials-context__class">
        <Text type="secondary">Enrolled class</Text>
        <Tag color={classId ? 'blue' : 'default'}>{classId || 'No class assigned'}</Tag>
      </div>
      <Text type="secondary" className="student-materials-context__hint">
        Assignments and materials below are filtered by this course.
      </Text>
    </div>
  );
}
