import { useMemo, useState } from 'react';
import { Button, Select, Space, Table, Tag } from 'antd';
import { RefreshCw } from 'lucide-react';
import AsyncState from '../../../components/common/AsyncState';
import StatusLabel from '../../../components/common/StatusLabel';

const dateLabel = (value) => {
  if (!value) return 'Chưa kiểm duyệt';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Chưa kiểm duyệt' : date.toLocaleDateString('vi-VN');
};

export default function ContributionLibrary({
  goldQa,
  rubrics,
  userId,
  canReview,
  loading,
  error,
  onRefresh,
}) {
  const [type, setType] = useState('ALL');
  const [status, setStatus] = useState('ALL');
  const records = useMemo(() => [
    ...goldQa.map((item) => ({ ...item, contributionType: 'GOLD_QA' })),
    ...rubrics.map((item) => ({ ...item, contributionType: 'RUBRIC' })),
  ]
    .filter((item) => canReview || item.authorId === userId)
    .filter((item) => type === 'ALL' || item.contributionType === type)
    .filter((item) => status === 'ALL' || item.status === status)
    .sort((left, right) => (
      new Date(right.updatedAt || right.createdAt || 0).getTime()
      - new Date(left.updatedAt || left.createdAt || 0).getTime()
    )), [canReview, goldQa, rubrics, status, type, userId]);

  const columns = [
    {
      title: 'Nội dung',
      key: 'content',
      render: (_, item) => (
        <div className="expert-training__primary-cell">
          <strong>{item.question || item.name}</strong>
          <span>{item.chapter}</span>
          <span className="expert-training__clamp-two">{item.goldAnswer || item.description || 'Không có mô tả'}</span>
        </div>
      ),
    },
    {
      title: 'Mục đích',
      key: 'purpose',
      width: 150,
      render: (_, item) => (
        <Tag color={item.usage === 'EVALUATION' ? 'purple' : undefined}>
          {item.usage || 'RUBRIC'}
        </Tag>
      ),
    },
    {
      title: 'Trạng thái',
      dataIndex: 'status',
      key: 'status',
      width: 165,
      render: (value) => <StatusLabel status={value} />,
    },
    {
      title: 'Kiểm duyệt',
      key: 'reviewedAt',
      width: 135,
      render: (_, item) => dateLabel(item.reviewedAt || item.approvedAt),
    },
  ];

  return (
    <section className="expert-training__section" aria-labelledby="library-heading">
      <div className="expert-training__section-heading">
        <div>
          <h2 id="library-heading">{canReview ? 'Thư viện nội dung chuyên gia' : 'Nội dung tôi đã đóng góp'}</h2>
          <p>Được tổng hợp trực tiếp từ Gold Q&A và Rubric của môn học, không tạo nguồn dữ liệu riêng.</p>
        </div>
        <Button icon={<RefreshCw size={16} />} onClick={onRefresh} loading={loading}>Làm mới</Button>
      </div>

      <div className="expert-training__filters">
        <Select
          aria-label="Loại nội dung"
          value={type}
          onChange={setType}
          className="expert-training__filter-control"
          options={[
            { value: 'ALL', label: 'Tất cả nội dung' },
            { value: 'GOLD_QA', label: 'Gold Q&A' },
            { value: 'RUBRIC', label: 'Rubric' },
          ]}
        />
        <Select
          aria-label="Trạng thái nội dung"
          value={status}
          onChange={setStatus}
          className="expert-training__filter-control"
          options={[
            { value: 'ALL', label: 'Tất cả trạng thái' },
            { value: 'PENDING_REVIEW', label: 'Chờ kiểm duyệt' },
            { value: 'APPROVED', label: 'Đã phê duyệt' },
            { value: 'INDEXED', label: 'Đã đưa vào RAG' },
            { value: 'REJECTED', label: 'Cần chỉnh sửa' },
          ]}
        />
        <Space className="expert-training__filter-count">{records.length} nội dung</Space>
      </div>

      <AsyncState
        loading={loading && !records.length}
        error={error}
        empty={!loading && !error && !records.length}
        emptyTitle="Chưa có nội dung phù hợp"
        emptyDescription="Đóng góp Gold Q&A hoặc Rubric từ một công việc chuyên gia để bắt đầu."
        onRetry={onRefresh}
      >
        <Table
          rowKey={(item) => `${item.contributionType}:${item.id}`}
          columns={columns}
          dataSource={records}
          pagination={{ pageSize: 8, hideOnSinglePage: true }}
          scroll={{ x: 760 }}
          size="middle"
        />
      </AsyncState>
    </section>
  );
}
