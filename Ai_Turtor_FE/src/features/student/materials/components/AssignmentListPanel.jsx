import {
  CalendarOutlined,
  FileDoneOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import { Alert, Button, Card, Empty, Skeleton, Tag, Tooltip, Typography } from 'antd';
import SearchableTable from '../../../../components/common/SearchableTable';
import StatusLabel from '../../../../components/common/StatusLabel';

const { Text } = Typography;

const getAssignmentId = (assignment) => assignment?.id || assignment?.assignmentId || '';

const formatDeadline = (value) => {
  if (!value) return { label: 'Không giới hạn', overdue: false };
  const deadline = new Date(value);
  if (Number.isNaN(deadline.getTime())) return { label: 'Chưa xác định', overdue: false };
  return {
    label: deadline.toLocaleString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }),
    overdue: deadline.getTime() < Date.now(),
  };
};

const getReadableError = (error) => {
  const message = String(error || '').trim();
  if (/unauthorized|\b401\b/i.test(message)) {
    return 'Phiên đăng nhập không còn hợp lệ. Vui lòng đăng nhập lại rồi tải lại danh sách.';
  }
  return message || 'Đã xảy ra lỗi khi tải dữ liệu. Vui lòng thử lại.';
};

const isSessionError = (error) => /phiên đăng nhập|unauthorized|\b401\b/i.test(String(error || ''));

const assignmentColumns = [
  {
    title: 'Bài tập',
    dataIndex: 'title',
    key: 'title',
    render: (title, record) => (
      <div className="student-assignment-title">
        <span className="student-assignment-title__icon" aria-hidden="true">
          <FileDoneOutlined />
        </span>
        <div>
          <Text strong>{title || 'Bài tập chưa đặt tên'}</Text>
          {(record.description || record.desc) && (
            <Text type="secondary" ellipsis>{record.description || record.desc}</Text>
          )}
        </div>
      </div>
    ),
  },
  {
    title: 'Loại',
    dataIndex: 'assignmentType',
    key: 'assignmentType',
    width: 140,
    responsive: ['md'],
    render: (type) => {
      const isExam = String(type || 'ASSIGNMENT').toUpperCase() === 'EXAM';
      return <Tag color={isExam ? 'gold' : 'blue'}>{isExam ? 'Bài kiểm tra' : 'Bài tập'}</Tag>;
    },
  },
  {
    title: 'Trạng thái',
    dataIndex: 'status',
    key: 'status',
    width: 140,
    render: (status, record) => {
      const normalized = String(record.submission?.status || status || 'PENDING').toUpperCase();
      return <StatusLabel status={normalized} />;
    },
  },
  {
    title: 'Điểm',
    dataIndex: 'score',
    key: 'score',
    width: 90,
    align: 'center',
    responsive: ['lg'],
    render: (score, record) => (
      <Text className={score == null ? '' : 'student-assignment-score'}>
        {score == null ? '—' : `${score}/${record.maxScore ?? 10}`}
      </Text>
    ),
  },
  {
    title: 'Hạn nộp',
    key: 'deadline',
    width: 190,
    render: (_, record) => {
      const value = record.dueAt || record.deadline;
      const deadline = formatDeadline(value);
      const wasSubmitted = Boolean(record.submission);
      return (
        <span className={`student-assignment-deadline${deadline.overdue && !wasSubmitted ? ' is-overdue' : ''}`}>
          <CalendarOutlined aria-hidden="true" />
          {deadline.label}
        </span>
      );
    },
  },
];

export default function AssignmentListPanel({
  assignments,
  loading = false,
  error = '',
  courseId,
  selectedAssignment,
  onSelect,
  onRetry,
  onLoginAgain,
}) {
  const selectedId = getAssignmentId(selectedAssignment);
  const safeAssignments = Array.isArray(assignments) ? assignments : [];
  const emptyTitle = courseId
    ? `Chưa có bài tập được xuất bản cho ${courseId}.`
    : 'Chọn môn học đã đăng ký để xem bài tập.';

  return (
    <Card
      className="materials-list-card"
      styles={{ body: { flex: 1, padding: 0, overflowY: 'auto' } }}
    >
      <div className="student-assignment-list__header">
        <div>
          <span className="student-assignment-list__eyebrow">Danh sách của bạn</span>
          <h2>Bài tập được giao</h2>
          <p>Chọn một bài để xem yêu cầu và nộp tệp.</p>
        </div>
        <div className="student-assignment-list__summary">
          <strong>{safeAssignments.length}</strong>
          <span>bài</span>
          <Tooltip title="Tải lại danh sách">
            <Button
              type="text"
              aria-label="Tải lại bài tập"
              icon={<ReloadOutlined />}
              loading={loading}
              disabled={!onRetry}
              onClick={onRetry}
            />
          </Tooltip>
        </div>
      </div>

      {error && (
        <Alert
          className="student-assignment-list__alert"
          type="error"
          showIcon
          message="Không tải được bài tập"
          description={getReadableError(error)}
          action={isSessionError(error) && onLoginAgain
            ? <Button type="primary" size="small" onClick={onLoginAgain}>Đăng nhập lại</Button>
            : onRetry ? <Button size="small" onClick={onRetry}>Thử lại</Button> : null}
        />
      )}

      {loading && safeAssignments.length === 0 ? (
        <div className="student-assignment-list__loading">
          <Skeleton active paragraph={{ rows: 5 }} />
        </div>
      ) : safeAssignments.length === 0 && !error ? (
        <Empty
          className="student-assignment-list__empty"
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={(
            <span>
              <strong>{emptyTitle}</strong>
              <small>Khi giảng viên giao bài mới, nội dung sẽ xuất hiện tại đây.</small>
            </span>
          )}
        />
      ) : (
        <SearchableTable
          dataSource={safeAssignments}
          columns={assignmentColumns}
          rowKey={getAssignmentId}
          searchKeys={['title', 'description', 'desc', 'assignmentType', 'status']}
          searchPlaceholder="Tìm bài tập"
          pagination={{ pageSize: 8, hideOnSinglePage: true }}
          size="middle"
          scroll={{ x: 700, y: 560 }}
          onRow={(record) => {
            const isSelected = selectedId === getAssignmentId(record);
            const selectRecord = () => onSelect?.(record);
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
          locale={{ emptyText: 'Không tìm thấy bài tập phù hợp.' }}
        />
      )}
    </Card>
  );
}
