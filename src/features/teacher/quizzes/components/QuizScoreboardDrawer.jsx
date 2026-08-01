import { Alert, Drawer, Empty, Skeleton, Space, Statistic, Table, Tag, Typography } from 'antd';
import { getQuizGradingModeLabel } from '../quizAssignmentUtils';
import { formatQuizDateTime } from '../../../student/quizzes/practiceQuizUtils';

const { Text, Title } = Typography;

const statusTagColor = {
  default: 'default',
  processing: 'processing',
  success: 'success',
  warning: 'gold',
};

export default function QuizScoreboardDrawer({
  open,
  assignment,
  loading,
  error,
  rows,
  summary,
  onClose,
}) {
  const title = assignment?.title || assignment?.topic || 'Quiz';

  const columns = [
    {
      title: 'Mã SV',
      dataIndex: 'studentId',
      key: 'studentId',
      width: 120,
      ellipsis: true,
    },
    {
      title: 'Họ tên',
      dataIndex: 'studentName',
      key: 'studentName',
      ellipsis: true,
    },
    {
      title: 'Trạng thái',
      dataIndex: 'statusLabel',
      key: 'statusLabel',
      width: 150,
      render: (_, record) => (
        <Tag color={statusTagColor[record.statusTone] || 'default'}>{record.statusLabel}</Tag>
      ),
    },
    {
      title: 'Điểm',
      dataIndex: 'scoreLabel',
      key: 'scoreLabel',
      width: 100,
      align: 'center',
    },
    {
      title: '%',
      dataIndex: 'percentLabel',
      key: 'percentLabel',
      width: 72,
      align: 'center',
    },
    {
      title: 'Nộp lúc',
      dataIndex: 'submittedAt',
      key: 'submittedAt',
      width: 150,
      render: (value) => formatQuizDateTime(value),
    },
  ];

  return (
    <Drawer
      title="Bảng điểm quiz"
      open={open}
      onClose={onClose}
      size="large"
      rootClassName="quiz-scoreboard-drawer"
      destroyOnHidden
    >
      {assignment && (
        <div className="quiz-scoreboard">
          <div className="quiz-scoreboard__head">
            <div>
              <Title level={4} style={{ margin: 0 }}>{title}</Title>
              <Space wrap size={[6, 6]}>
                {assignment.classId && <Tag>{assignment.classId}</Tag>}
                {assignment.gradingMode && (
                  <Tag>{getQuizGradingModeLabel(assignment.gradingMode)}</Tag>
                )}
                <Text type="secondary">
                  {assignment.targetType === 'SELECTED_STUDENTS'
                    ? `${assignment.targetStudentIds?.length || summary.total} sinh viên được giao`
                    : 'Giao cả lớp'}
                </Text>
              </Space>
            </div>
          </div>

          <div className="quiz-scoreboard__stats">
            <Statistic title="Danh sách" value={summary.total} />
            <Statistic title="Đã nộp" value={summary.submitted} />
            <Statistic title="Đã chấm" value={summary.graded} />
            <Statistic title="Chưa làm" value={summary.notStarted} />
          </div>

          {error && (
            <Alert type="error" showIcon title="Không tải được điểm" description={error} />
          )}

          {loading ? (
            <Skeleton active paragraph={{ rows: 8 }} />
          ) : !rows.length ? (
            <Empty description="Chưa có sinh viên hoặc lượt làm bài cho quiz này." />
          ) : (
            <Table
              className="quiz-scoreboard__table"
              size="small"
              rowKey="key"
              columns={columns}
              dataSource={rows}
              pagination={{ pageSize: 15, showSizeChanger: true, showTotal: (total) => `${total} sinh viên` }}
              scroll={{ x: 720 }}
            />
          )}
        </div>
      )}
    </Drawer>
  );
}
