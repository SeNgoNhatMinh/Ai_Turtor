import { useEffect, useState } from 'react';
import {
  Alert,
  Button,
  Descriptions,
  Drawer,
  Empty,
  Form,
  Grid,
  Input,
  Segmented,
  Space,
  Tag,
  Typography,
} from 'antd';
import { Check, RefreshCw, X } from 'lucide-react';
import AsyncState from '../../../components/common/AsyncState';
import { confirmAction, confirmDanger } from '../../../components/common/confirmDialog';
import MasterDetailLayout from '../../../components/common/MasterDetailLayout';
import StatusLabel from '../../../components/common/StatusLabel';
import { groupReviewQueue } from '../expertTrainingSelectors';

const { Paragraph, Text, Title } = Typography;

export default function SeniorReviewQueue({
  goldQa,
  rubrics,
  selectedReviewId,
  loading,
  error,
  pendingAction,
  onSelectReview,
  onRefresh,
  onReviewGoldQa,
  onReviewRubric,
}) {
  const [form] = Form.useForm();
  const screens = Grid.useBreakpoint();
  const isMobile = !screens.md;
  const [kindFilter, setKindFilter] = useState('ALL');

  const queue = groupReviewQueue(goldQa, rubrics);
  const filteredQueue = kindFilter === 'ALL'
    ? queue
    : queue.filter((entry) => entry.kind === kindFilter);
  const selectedEntry = queue.find((entry) => entry.id === selectedReviewId) || null;

  useEffect(() => {
    if (!selectedReviewId && filteredQueue.length && !isMobile) {
      onSelectReview(filteredQueue[0].id);
    }
  }, [filteredQueue, isMobile, onSelectReview, selectedReviewId]);

  useEffect(() => {
    if (selectedReviewId) form.resetFields();
  }, [form, selectedReviewId]);

  const setFilter = (value) => {
    setKindFilter(value);
    if (selectedEntry && value !== 'ALL' && selectedEntry.kind !== value) onSelectReview(null);
  };

  const submitReview = (decision, anchorRect) => {
    if (!selectedEntry || pendingAction) return;
    const values = form.getFieldsValue();
    const note = String(values.reviewNote || '').trim();
    if (decision === 'reject' && !note) {
      form.setFields([{ name: 'reviewNote', errors: ['Nêu rõ nội dung cần chỉnh sửa.'] }]);
      return;
    }
    const execute = async () => {
      const handler = selectedEntry.kind === 'GOLD_QA' ? onReviewGoldQa : onReviewRubric;
      const result = await handler(selectedEntry.item, decision, {
        reviewNote: decision === 'approve' ? note : '',
        rejectionReason: decision === 'reject' ? note : '',
      });
      if (result) onSelectReview(null);
    };
    const common = {
      anchorRect,
      onOk: execute,
      cancelText: 'Hủy',
    };
    if (decision === 'approve') {
      const isTraining = selectedEntry.kind === 'GOLD_QA' && selectedEntry.item.usage === 'TRAINING';
      confirmAction({
        ...common,
        title: 'Phê duyệt nội dung?',
        content: isTraining
          ? 'TRAINING Gold Q&A sẽ được backend index vào RAG sau khi phê duyệt.'
          : 'Nội dung sẽ được phê duyệt nhưng không được index vào RAG.',
        okText: 'Phê duyệt',
      });
      return;
    }
    confirmDanger({
      ...common,
      title: 'Yêu cầu giảng viên chỉnh sửa?',
      content: 'Task sẽ trở lại trạng thái Đang thực hiện và hiển thị ghi chú này cho giảng viên.',
      okText: 'Yêu cầu chỉnh sửa',
    });
  };

  const master = (
    <div className="expert-training__review-master">
      <div className="expert-training__review-master-head">
        <div>
          <strong>Hàng chờ kiểm duyệt</strong>
          <span>{queue.length} nội dung</span>
        </div>
        <Button
          type="text"
          icon={<RefreshCw size={16} />}
          aria-label="Làm mới hàng chờ"
          onClick={onRefresh}
          loading={loading}
        />
      </div>
      <Segmented
        block
        value={kindFilter}
        onChange={setFilter}
        options={[
          { value: 'ALL', label: `Tất cả (${queue.length})` },
          { value: 'GOLD_QA', label: 'Gold Q&A' },
          { value: 'RUBRIC', label: 'Rubric' },
        ]}
      />
      <AsyncState
        compact
        loading={loading && !queue.length}
        error={error}
        empty={!loading && !error && !filteredQueue.length}
        emptyTitle="Không có nội dung chờ duyệt"
        emptyDescription="Nội dung mới từ giảng viên sẽ xuất hiện tại đây sau canonical refetch."
        onRetry={onRefresh}
      >
        <div className="expert-training__review-list" role="list">
          {filteredQueue.map((entry) => {
            const item = entry.item;
            const title = entry.kind === 'GOLD_QA' ? item.question : item.name;
            return (
              <button
                type="button"
                role="listitem"
                key={`${entry.kind}:${entry.id}`}
                className={`expert-training__review-list-item ${entry.id === selectedReviewId ? 'is-active' : ''}`}
                onClick={() => onSelectReview(entry.id)}
              >
                <span className="expert-training__review-list-title">{title}</span>
                <span>{item.chapter} · {entry.kind === 'GOLD_QA' ? item.usage : 'RUBRIC'}</span>
                <StatusLabel status={item.status} />
              </button>
            );
          })}
        </div>
      </AsyncState>
    </div>
  );

  const detail = selectedEntry ? (
    <ReviewDetail
      entry={selectedEntry}
      form={form}
      pendingAction={pendingAction}
      onApprove={(event) => submitReview('approve', event.currentTarget.getBoundingClientRect())}
      onReject={(event) => submitReview('reject', event.currentTarget.getBoundingClientRect())}
    />
  ) : (
    <div className="expert-training__review-empty">
      <Empty description="Chọn một nội dung để xem chi tiết và kiểm duyệt." />
    </div>
  );

  return (
    <section className="expert-training__section" aria-labelledby="review-heading">
      <div className="expert-training__section-heading">
        <div>
          <h2 id="review-heading">Kiểm duyệt độc lập</h2>
          <p>TRAINING chỉ vào RAG sau khi duyệt; EVALUATION luôn được giữ riêng làm holdout.</p>
        </div>
      </div>

      {isMobile ? (
        <>
          <div className="expert-training__review-mobile-master">{master}</div>
          <Drawer
            title="Chi tiết kiểm duyệt"
            open={Boolean(selectedEntry)}
            onClose={() => onSelectReview(null)}
            size="large"
            rootClassName="expert-training__drawer"
          >
            {detail}
          </Drawer>
        </>
      ) : (
        <MasterDetailLayout
          master={master}
          detail={detail}
          className="expert-training__review-layout"
        />
      )}
    </section>
  );
}

function ReviewDetail({ entry, form, pendingAction, onApprove, onReject }) {
  const item = entry.item;
  const isGold = entry.kind === 'GOLD_QA';
  const pending = Boolean(pendingAction);

  return (
    <div className="expert-training__review-detail-panel">
      <div className="expert-training__review-detail-head">
        <div>
          <span className="expert-training__eyebrow">NỘI DUNG CHỜ DUYỆT</span>
          <Title level={4}>{isGold ? item.question : item.name}</Title>
        </div>
        <StatusLabel status={item.status} />
      </div>

      <Descriptions bordered size="small" column={1}>
        <Descriptions.Item label="Chương">{item.chapter}</Descriptions.Item>
        <Descriptions.Item label="Loại">
          {isGold ? `Gold Q&A · ${item.usage}` : 'Rubric'}
        </Descriptions.Item>
        {isGold && <Descriptions.Item label="Độ khó">{item.difficulty}</Descriptions.Item>}
      </Descriptions>

      {isGold ? (
        <>
          <section className="expert-training__review-content-section">
            <h3>Câu hỏi chuẩn</h3>
            <Paragraph>{item.question}</Paragraph>
          </section>
          <section className="expert-training__review-content-section">
            <h3>Gold Answer</h3>
            <Paragraph className="expert-training__preserve-text">{item.goldAnswer}</Paragraph>
          </section>
          <Alert
            type={item.usage === 'EVALUATION' ? 'info' : 'warning'}
            showIcon
            title={item.usage === 'EVALUATION' ? 'Evaluation holdout riêng tư' : 'Training Gold Q&A có thể vào RAG'}
            description={item.usage === 'EVALUATION'
              ? 'Phê duyệt chỉ đưa nội dung vào bộ đánh giá, không index vào RAG.'
              : 'Phê duyệt sẽ cho phép backend index nội dung này vào tri thức của môn học.'}
          />
        </>
      ) : (
        <section className="expert-training__review-content-section">
          <h3>Mô tả Rubric</h3>
          <Paragraph>{item.description || 'Không có mô tả.'}</Paragraph>
          <Space wrap>
            {Object.entries(item.criteriaWeights).map(([name, weight]) => (
              <Tag key={name}>{name}: {Math.round(Number(weight) * 100)}%</Tag>
            ))}
          </Space>
        </section>
      )}

      <Form form={form} layout="vertical" className="expert-training__review-form">
        <Form.Item label="Nhận xét kiểm duyệt" name="reviewNote">
          <Input.TextArea rows={4} maxLength={5000} placeholder="Ghi nhận xét hoặc nêu rõ nội dung cần chỉnh sửa..." />
        </Form.Item>
      </Form>

      <div className="expert-training__review-actions">
        <Text type="secondary">Backend quyết định trạng thái cuối; FE sẽ tải lại dữ liệu canonical sau thao tác.</Text>
        <Space wrap>
          <Button danger icon={<X size={15} />} onClick={onReject} disabled={pending}>
            Yêu cầu chỉnh sửa
          </Button>
          <Button
            type="primary"
            icon={<Check size={15} />}
            onClick={onApprove}
            loading={pendingAction === `${isGold ? 'review-gold' : 'review-rubric'}:${item.id}`}
            disabled={pending}
          >
            Phê duyệt
          </Button>
        </Space>
      </div>
    </div>
  );
}
