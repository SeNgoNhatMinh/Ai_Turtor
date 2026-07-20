import { useMemo, useState } from 'react';
import {
  Alert,
  Button,
  Descriptions,
  Form,
  Input,
  Modal,
  Space,
  Table,
  Tabs,
  Tag,
  Typography,
} from 'antd';
import { Check, RefreshCw, X } from 'lucide-react';
import AsyncState from '../../../components/common/AsyncState';
import { getEntityStatusColor } from '../expertTrainingUtils';

const { Paragraph, Text, Title } = Typography;

export default function SeniorReviewQueue({
  goldQa,
  rubrics,
  loading,
  error,
  pendingAction,
  onRefresh,
  onReviewGoldQa,
  onReviewRubric,
}) {
  const [reviewTarget, setReviewTarget] = useState(null);
  const [form] = Form.useForm();
  const pendingGold = useMemo(
    () => goldQa.filter((item) => item.status === 'PENDING_REVIEW'),
    [goldQa],
  );
  const pendingRubrics = useMemo(
    () => rubrics.filter((item) => item.status === 'PENDING_REVIEW'),
    [rubrics],
  );

  const openReview = (kind, item, decision) => {
    form.resetFields();
    setReviewTarget({ kind, item, decision });
  };

  const submitReview = async (values) => {
    const handler = reviewTarget.kind === 'gold' ? onReviewGoldQa : onReviewRubric;
    const result = await handler(reviewTarget.item, reviewTarget.decision, values);
    if (result) setReviewTarget(null);
  };

  const actionCell = (kind, item) => (
    <Space size={4}>
      <Button
        size="small"
        type="primary"
        icon={<Check size={14} />}
        onClick={() => openReview(kind, item, 'approve')}
        disabled={Boolean(pendingAction)}
      >
        Approve
      </Button>
      <Button
        size="small"
        danger
        icon={<X size={14} />}
        onClick={() => openReview(kind, item, 'reject')}
        disabled={Boolean(pendingAction)}
      >
        Reject
      </Button>
    </Space>
  );

  const goldColumns = [
    {
      title: 'Gold Q&A',
      key: 'content',
      render: (_, item) => (
        <div className="expert-training__primary-cell">
          <strong>{item.question}</strong>
          <span>{item.chapter}</span>
          <span className="expert-training__clamp-two">{item.goldAnswer}</span>
        </div>
      ),
    },
    {
      title: 'Purpose',
      dataIndex: 'usage',
      key: 'usage',
      width: 125,
      render: (value) => <Tag color={value === 'TRAINING' ? 'blue' : 'purple'}>{value}</Tag>,
    },
    {
      title: 'Difficulty',
      dataIndex: 'difficulty',
      key: 'difficulty',
      width: 110,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 145,
      render: (value) => <Tag color={getEntityStatusColor(value)}>{value.replaceAll('_', ' ')}</Tag>,
    },
    {
      title: '',
      key: 'actions',
      fixed: 'right',
      width: 180,
      render: (_, item) => actionCell('gold', item),
    },
  ];

  const rubricColumns = [
    {
      title: 'Rubric',
      key: 'rubric',
      render: (_, item) => (
        <div className="expert-training__primary-cell">
          <strong>{item.name}</strong>
          <span>{item.chapter}</span>
          <span className="expert-training__clamp-two">{item.description || 'No description'}</span>
        </div>
      ),
    },
    {
      title: 'Criteria',
      dataIndex: 'criteriaWeights',
      key: 'criteria',
      width: 260,
      render: (weights) => (
        <Space size={[4, 4]} wrap>
          {Object.entries(weights).map(([name, weight]) => (
            <Tag key={name}>{name}: {Math.round(Number(weight) * 100)}%</Tag>
          ))}
        </Space>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 145,
      render: (value) => <Tag color={getEntityStatusColor(value)}>{value.replaceAll('_', ' ')}</Tag>,
    },
    {
      title: '',
      key: 'actions',
      fixed: 'right',
      width: 180,
      render: (_, item) => actionCell('rubric', item),
    },
  ];

  const queueItems = [
    {
      key: 'gold',
      label: `Gold Q&A (${pendingGold.length})`,
      children: (
        <AsyncState
          loading={loading && !pendingGold.length}
          error={error}
          empty={!loading && !error && !pendingGold.length}
          emptyTitle="No Gold Q&A waiting for review"
          emptyDescription="New teacher contributions will appear here through the canonical API and realtime refetch."
          onRetry={onRefresh}
        >
          <Table
            rowKey="id"
            columns={goldColumns}
            dataSource={pendingGold}
            pagination={{ pageSize: 8, hideOnSinglePage: true }}
            scroll={{ x: 900 }}
            size="middle"
          />
        </AsyncState>
      ),
    },
    {
      key: 'rubrics',
      label: `Rubrics (${pendingRubrics.length})`,
      children: (
        <AsyncState
          loading={loading && !pendingRubrics.length}
          error={error}
          empty={!loading && !error && !pendingRubrics.length}
          emptyTitle="No rubrics waiting for review"
          emptyDescription="Approved rubrics become the quality standard for Tutor V2 evaluation."
          onRetry={onRefresh}
        >
          <Table
            rowKey="id"
            columns={rubricColumns}
            dataSource={pendingRubrics}
            pagination={{ pageSize: 8, hideOnSinglePage: true }}
            scroll={{ x: 820 }}
            size="middle"
          />
        </AsyncState>
      ),
    },
  ];

  const target = reviewTarget?.item;
  const isReject = reviewTarget?.decision === 'reject';
  const isGold = reviewTarget?.kind === 'gold';

  return (
    <section className="expert-training__section" aria-labelledby="review-heading">
      <div className="expert-training__section-heading">
        <div>
          <h2 id="review-heading">Senior Review Queue</h2>
          <p>Independent approval is required before training knowledge enters RAG or holdout data enters evaluation.</p>
        </div>
        <Button icon={<RefreshCw size={16} />} onClick={onRefresh} loading={loading}>Refresh</Button>
      </div>

      <Alert
        type="warning"
        showIcon
        title="Review the purpose before approval"
        description="TRAINING Gold Q&A is indexed into course knowledge. EVALUATION Gold Q&A stays private and must never be indexed."
      />

      <Tabs items={queueItems} />

      <Modal
        title={isReject ? 'Reject contribution' : 'Approve contribution'}
        open={Boolean(reviewTarget)}
        onCancel={() => setReviewTarget(null)}
        onOk={() => form.submit()}
        okText={isReject ? 'Reject' : 'Approve'}
        okButtonProps={{ danger: isReject }}
        confirmLoading={Boolean(target && pendingAction.includes(target.id))}
        width={720}
        destroyOnHidden
      >
        {target && (
          <div className="expert-training__review-detail">
            <Descriptions bordered size="small" column={1}>
              <Descriptions.Item label="Chapter">{target.chapter}</Descriptions.Item>
              <Descriptions.Item label="Type">{isGold ? `Gold Q&A · ${target.usage}` : 'Rubric'}</Descriptions.Item>
              <Descriptions.Item label="Status">{target.status.replaceAll('_', ' ')}</Descriptions.Item>
            </Descriptions>

            {isGold ? (
              <>
                <Title level={5}>Question</Title>
                <Paragraph>{target.question}</Paragraph>
                <Title level={5}>Gold answer</Title>
                <Paragraph className="expert-training__preserve-text">{target.goldAnswer}</Paragraph>
                {target.usage === 'EVALUATION' && (
                  <Alert
                    type="info"
                    showIcon
                    title="Private evaluation holdout"
                    description="Approval stores this benchmark as APPROVED with no indexing timestamp."
                  />
                )}
              </>
            ) : (
              <>
                <Title level={5}>{target.name}</Title>
                <Paragraph>{target.description || 'No description provided.'}</Paragraph>
                <Space wrap>
                  {Object.entries(target.criteriaWeights).map(([name, weight]) => (
                    <Tag key={name}>{name}: {Math.round(Number(weight) * 100)}%</Tag>
                  ))}
                </Space>
              </>
            )}

            <Form form={form} layout="vertical" onFinish={submitReview} className="expert-training__modal-form">
              {isReject ? (
                <Form.Item
                  label="Rejection reason"
                  name="rejectionReason"
                  rules={[{ required: true, whitespace: true, message: 'Explain what the author must correct.' }]}
                >
                  <Input.TextArea rows={4} maxLength={5000} />
                </Form.Item>
              ) : (
                <Form.Item label="Review note" name="reviewNote">
                  <Input.TextArea rows={3} maxLength={5000} placeholder="Optional quality note" />
                </Form.Item>
              )}
            </Form>
            <Text type="secondary">
              The backend owns the final status transition. The frontend will reload canonical task and contribution data after this action.
            </Text>
          </div>
        )}
      </Modal>
    </section>
  );
}
