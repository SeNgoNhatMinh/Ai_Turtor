import { Button, Table, Tag } from 'antd';
import AsyncState from '../../../../components/common/AsyncState';
import StatusLabel from '../../../../components/common/StatusLabel';
import { formatPercent } from '../../expertTrainingUtils';
import { formatEvaluationDate } from './evaluationViewUtils';

const columnsFor = (onOpenDetail) => [
  {
    title: 'Phạm vi Evaluation',
    key: 'scope',
    render: (_, run) => (
      <div className="expert-training__primary-cell">
        <strong>{run.chapter}</strong>
        <span>{run.harnessVersion || 'Harness mặc định'} · KB {run.kbVersion || 'hiện tại'}</span>
      </div>
    ),
  },
  {
    title: 'Trạng thái',
    dataIndex: 'status',
    key: 'status',
    width: 130,
    render: (value) => <StatusLabel status={value} />,
  },
  {
    title: 'Test case',
    key: 'cases',
    width: 100,
    align: 'center',
    render: (_, run) => `${run.passedCases}/${run.totalCases}`,
  },
  {
    title: 'Điểm trung bình',
    dataIndex: 'averageScore',
    key: 'score',
    width: 130,
    render: formatPercent,
  },
  {
    title: 'Hallucination',
    dataIndex: 'hallucinationRate',
    key: 'hallucination',
    width: 130,
    render: formatPercent,
  },
  {
    title: 'Regression',
    dataIndex: 'regressionDetected',
    key: 'regression',
    width: 110,
    render: (value) => value ? <Tag color="red">Có</Tag> : <Tag color="green">Không</Tag>,
  },
  {
    title: 'Hoàn tất lúc',
    dataIndex: 'completedAt',
    key: 'completedAt',
    width: 180,
    render: formatEvaluationDate,
  },
  {
    title: '',
    key: 'action',
    fixed: 'right',
    width: 90,
    render: (_, run) => <Button size="small" onClick={() => onOpenDetail(run.id)}>Chi tiết</Button>,
  },
];

export default function EvaluationRunsTable({
  runs,
  loading,
  error,
  onRefresh,
  onOpenDetail,
}) {
  return (
    <AsyncState
      loading={loading && !runs.length}
      error={error}
      empty={!loading && !error && !runs.length}
      emptyTitle="Môn học chưa có phiên Evaluation"
      emptyDescription="Phê duyệt ít nhất một Evaluation Gold Q&A trước khi chạy."
      onRetry={onRefresh}
    >
      <Table
        rowKey="id"
        columns={columnsFor(onOpenDetail)}
        dataSource={runs}
        pagination={{ pageSize: 8, hideOnSinglePage: true }}
        scroll={{ x: 1080 }}
        size="middle"
      />
    </AsyncState>
  );
}
