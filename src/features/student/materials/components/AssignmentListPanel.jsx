import { Card, Table, Tag, Typography } from 'antd';

const { Text } = Typography;

const getAssignmentId = (assignment) => assignment?.id || assignment?.assignmentId || '';

const assignmentColumns = [
  {
    title: 'Assignment',
    dataIndex: 'title',
    key: 'title',
    render: (title) => <Text strong>{title}</Text>,
  },
  {
    title: 'Type',
    dataIndex: 'assignmentType',
    key: 'assignmentType',
    render: (type) => <Tag>{type || 'ASSIGNMENT'}</Tag>,
  },
  {
    title: 'Status',
    dataIndex: 'status',
    key: 'status',
    render: (status, record) => {
      const normalized = String(record.submission?.status || status || 'PENDING').toUpperCase();
      const color = normalized === 'REVIEWED' ? 'green' : record.submission ? 'blue' : 'orange';
      return <Tag color={color}>{normalized.replaceAll('_', ' ')}</Tag>;
    },
  },
  {
    title: 'Score',
    dataIndex: 'score',
    key: 'score',
    render: (score, record) => score == null ? '-' : `${score}/${record.maxScore ?? 10}`,
  },
  {
    title: 'Deadline',
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
      title="Assigned Materials & Assignments"
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
            ? `No assignments published for ${courseId}. Choose another enrolled course above.`
            : 'Choose an enrolled course to view assignments.',
        }}
      />
    </Card>
  );
}
