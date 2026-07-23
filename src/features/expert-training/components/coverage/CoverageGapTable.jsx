import { Button, Space, Table, Tag, Typography } from 'antd';
import AsyncState from '../../../../components/common/AsyncState';
import StatusLabel from '../../../../components/common/StatusLabel';
import { getMaterialHealthMeta } from '../../expertTrainingUtils';

const { Text } = Typography;

const buildColumns = ({ canReview, onCreateTask, pendingAction }) => [
  {
    title: 'Chương',
    dataIndex: 'chapter',
    key: 'chapter',
    width: 220,
    render: (value, item) => (
      <div className="expert-training__primary-cell">
        <strong>{value}</strong>
        <span>{item.reasons.join(' · ') || 'Đã đạt mục tiêu độ phủ'}</span>
      </div>
    ),
  },
  {
    title: 'Mức độ',
    dataIndex: 'severity',
    key: 'severity',
    width: 110,
    render: (value) => <StatusLabel status={value} />,
  },
  {
    title: 'Trạng thái',
    dataIndex: 'status',
    key: 'status',
    width: 130,
    render: (value) => <StatusLabel status={value} />,
  },
  {
    title: 'Học liệu',
    key: 'materials',
    width: 170,
    render: (_, gap) => {
      const health = getMaterialHealthMeta(gap.materialHealth);
      return (
        <Space orientation="vertical" size={2}>
          <Tag color={health.color}>{health.label}</Tag>
          <Text type="secondary">{gap.chunkCount} chunks · {gap.materialCount} nguồn</Text>
        </Space>
      );
    },
  },
  {
    title: 'Training Gold Q&A',
    dataIndex: 'trainingGoldCount',
    key: 'training',
    align: 'center',
    width: 150,
  },
  {
    title: 'Evaluation holdout',
    dataIndex: 'evaluationGoldCount',
    key: 'evaluation',
    align: 'center',
    width: 150,
  },
  ...(canReview && onCreateTask ? [{
    title: '',
    key: 'action',
    fixed: 'right',
    width: 110,
    render: (_, gap) => (
      <Button
        size="small"
        onClick={() => onCreateTask(gap)}
        disabled={Boolean(pendingAction) || ['TASK_CREATED', 'RESOLVED'].includes(gap.status)}
        title={gap.status === 'TASK_CREATED'
          ? 'Task đã được tạo cho thiếu hụt này'
          : gap.status === 'RESOLVED'
            ? 'Thiếu hụt này đã được xử lý'
            : 'Tạo Training và Evaluation task cho chapter'}
      >
        Tạo task
      </Button>
    ),
  }] : []),
];

export default function CoverageGapTable({
  gaps,
  loading,
  error,
  canReview,
  pendingAction,
  onRefresh,
  onCreateTask,
}) {
  return (
    <AsyncState
      loading={loading && !gaps.length}
      error={error}
      empty={!loading && !error && !gaps.length}
      emptyTitle="Môn học chưa có thiếu hụt độ phủ"
      emptyDescription="Senior Mentor hoặc Admin có thể phân tích các chương cần kiểm tra."
      onRetry={onRefresh}
    >
      <Table
        rowKey="id"
        columns={buildColumns({ canReview, onCreateTask, pendingAction })}
        dataSource={gaps}
        pagination={{ pageSize: 8, hideOnSinglePage: true }}
        scroll={{ x: 900 }}
        size="middle"
      />
    </AsyncState>
  );
}
