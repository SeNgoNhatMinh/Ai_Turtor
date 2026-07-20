import { Card, Table, Tag, Typography } from 'antd';
import StatusLabel from '../../../../components/common/StatusLabel';

const { Text } = Typography;

const getAssignmentId = (assignment) => assignment?.id || assignment?.assignmentId || '';

const assignmentColumns = [
  {
    title: 'Bài tập',
    dataIndex: 'title',
    key: 'title',
    render: (title) => <Text strong>{title}</Text>,
  },
  {
    title: 'Loại',
    dataIndex: 'assignmentType',
    key: 'assignmentType',
    render: (type) => <Tag>{String(type || 'ASSIGNMENT').toUpperCase() === 'EXAM' ? 'Bài kiểm tra' : 'Bài tập'}</Tag>,
  },
  {
    title: 'Trạng thái',
    dataIndex: 'status',
    key: 'status',
    render: (status, record) => {
      const normalized = String(record.submission?.status || status || 'PENDING').toUpperCase();
      return <StatusLabel status={normalized} />;
    },
  },
  {
    title: 'Điểm',
    dataIndex: 'score',
    key: 'score',
    render: (score, record) => score == null ? '-' : `${score}/${record.maxScore ?? 10}`,
  },
  {
    title: 'Hạn nộp',
    key: 'deadline',
    render: (_, record) => {
      const value = record.dueAt || record.deadline;
      return value ? new Date(value).toLocaleString() : '-';
    },
  },
];

export default function AssignmentListPanel({
  assignments,
  courseId,
  selectedAssignment,
  onSelect,
}) {
  const selectedId = getAssignmentId(selectedAssignment);

  return (
    <Card
      title="Bài tập được giao"
      className="materials-list-card"
      styles={{ body: { flex: 1, padding: 0, overflowY: 'auto' } }}
    >
      <Table
        dataSource={Array.isArray(assignments) ? assignments : []}
        columns={assignmentColumns}
        rowKey={getAssignmentId}
        pagination={false}
        onRow={(record) => {
          const isSelected = selectedId === getAssignmentId(record);
          const selectRecord = () => onSelect(record);
          return {
            onClick: selectRecord,
            onKeyDown: (event) => {
              if (event.key !== 'Enter' && event.key !== ' ') return;
              event.preventDefault();
              selectRecord();
            },
            className: isSelected
              ? 'student-assignment-row is-selected'
              : 'student-assignment-row',
            style: { cursor: 'pointer' },
            tabIndex: 0,
            'aria-selected': isSelected,
          };
        }}
        locale={{
          emptyText: courseId
            ? `Chưa có bài tập được xuất bản cho ${courseId}.`
            : 'Chọn môn học đã đăng ký để xem bài tập.',
        }}
      />
    </Card>
  );
}
