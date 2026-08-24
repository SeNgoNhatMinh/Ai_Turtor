import { useEffect, useState } from 'react';
import {
  Drawer,
  Empty,
  Form,
  Grid,
  Segmented,
} from 'antd';
import {
  BookOpenCheck,
  ChevronRight,
  ClipboardCheck,
  GraduationCap,
  RefreshCw,
} from 'lucide-react';
import AsyncState from '../../../components/common/AsyncState';
import ActionButton from '../../../components/common/ActionButton';
import { CollectionPagination, CollectionSearch } from '../../../components/common/CollectionControls';
import { confirmAction, confirmDanger } from '../../../components/common/confirmDialog';
import MasterDetailLayout from '../../../components/common/MasterDetailLayout';
import StatusLabel from '../../../components/common/StatusLabel';
import { useCollectionView } from '../../../hooks/useCollectionView';
import { groupReviewQueue } from '../expertTrainingSelectors';
import ExpertReviewDetail from './review/ExpertReviewDetail';
import { DEFAULT_APPROVAL_NOTE } from './review/reviewConstants';

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
  const collection = useCollectionView(filteredQueue, {
    initialPageSize: 20,
    pageSizeOptions: [10, 20, 50],
    searchKeys: ['item.question', 'item.chapter', 'item.authorId', 'item.status'],
  });
  const selectedEntry = queue.find((entry) => entry.id === selectedReviewId) || null;

  useEffect(() => {
    if (!selectedReviewId && filteredQueue.length && !isMobile) {
      onSelectReview(filteredQueue[0].id);
    }
  }, [filteredQueue, isMobile, onSelectReview, selectedReviewId]);

  useEffect(() => {
    if (selectedReviewId) {
      form.setFieldsValue({ reviewNote: DEFAULT_APPROVAL_NOTE });
    }
  }, [form, selectedReviewId]);

  const setFilter = (value) => {
    setKindFilter(value);
    if (selectedEntry && value !== 'ALL' && selectedEntry.kind !== value) onSelectReview(null);
  };

  const submitReview = (decision, anchorRect) => {
    if (!selectedEntry || pendingAction) return;
    const values = form.getFieldsValue();
    const note = String(values.reviewNote || '').trim();
    if (decision === 'reject' && (!note || note === DEFAULT_APPROVAL_NOTE)) {
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
      const item = selectedEntry.item;
      confirmAction({
        ...common,
        title: 'Nạp Q&A vàng vào RAG?',
        content: item.examPassed
          ? 'AI đã đạt trên giáo trình. Nạp câu này vào RAG brain.'
          : 'AI chưa đạt. Vẫn có thể nạp nếu bạn thấy hợp tài liệu, hoặc trả Teacher viết lại.',
        okText: 'Nạp vào RAG',
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
        <div className="expert-training__review-master-title">
          <span className="expert-training__review-master-icon"><ClipboardCheck size={18} /></span>
          <div>
            <strong>Hàng chờ kiểm duyệt</strong>
            <span>{collection.filteredCount} / {queue.length} bài thi</span>
          </div>
        </div>
        <ActionButton
          intent="text"
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
          { value: 'GOLD_QA', label: 'Q&A vàng' },
        ]}
      />
      <CollectionSearch
        query={collection.query}
        onQueryChange={collection.setQuery}
        filteredCount={collection.filteredCount}
        totalCount={collection.totalCount}
        placeholder="Tìm câu hỏi, chương hoặc Teacher"
      />
      <AsyncState
        compact
        loading={loading && !queue.length}
        error={error}
        empty={!loading && !error && !collection.filteredCount}
        emptyTitle="Chưa có bài thi"
        emptyDescription="Khi giảng viên nộp Q&A vàng, hệ thống chấm AI rồi hiện bài thi tại đây."
        onRetry={onRefresh}
      >
        <div className="expert-training__review-list" role="list">
          {collection.visibleItems.map((entry) => {
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
                <span className="expert-training__review-list-topline">
                  <span className="expert-training__review-kind">{entry.kind === 'GOLD_QA' ? 'Q&A vàng' : 'Rubric'}</span>
                  <StatusLabel status={item.status} />
                </span>
                <span className="expert-training__review-list-title">{title}</span>
                <span className="expert-training__review-list-meta">
                  <span><BookOpenCheck size={13} /> {item.chapter || 'Chưa xác định chương'}</span>
                  <span><GraduationCap size={13} /> {item.authorId || 'Teacher'}</span>
                </span>
                <span className={`expert-training__review-list-result ${item.examPassed ? 'is-passed' : item.examPassed === false ? 'is-revision' : ''}`}>
                  <strong>
                    {item.examScore == null ? 'Chưa có điểm' : `Điểm AI ${Math.round(Number(item.examScore) * 100)}%`}
                  </strong>
                  <span>{item.examPassed ? 'Đạt' : item.examPassed === false ? 'Cần xem lại' : 'Chờ chấm'}</span>
                  <ChevronRight size={15} />
                </span>
              </button>
            );
          })}
        </div>
      </AsyncState>
      <CollectionPagination collection={collection} />
    </div>
  );

  const detail = selectedEntry ? (
    <ExpertReviewDetail
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
      <div className="expert-training__section-heading expert-training__review-section-heading">
        <div className="expert-training__review-section-copy">
          <span className="expert-training__review-section-icon"><ClipboardCheck size={21} /></span>
          <div>
            <span className="expert-training__eyebrow">KIỂM DUYỆT CHẤT LƯỢNG</span>
            <h2 id="review-heading">Bài thi Q&A vàng</h2>
            <p>So sánh đáp án Teacher với câu AI trả từ giáo trình trước khi quyết định nạp vào RAG.</p>
          </div>
        </div>
        <div className="expert-training__review-queue-summary" aria-label={`${queue.length} bài thi chờ duyệt`}>
          <strong>{queue.length}</strong>
          <span>Chờ Senior</span>
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
