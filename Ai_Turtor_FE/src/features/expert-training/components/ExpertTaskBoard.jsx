import { useMemo, useState } from 'react';
import { Card, Modal, Segmented, Space, Tag, Typography } from 'antd';
import {
  BookOpenCheck,
  CheckCircle2,
  Clock3,
  Database,
  Eye,
  Loader2,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
} from 'lucide-react';
import GoldQaExamCompare from './contribution/GoldQaExamCompare';
import ActionButton from '../../../components/common/ActionButton';
import AsyncState from '../../../components/common/AsyncState';
import { CollectionPagination, CollectionSearch } from '../../../components/common/CollectionControls';
import StatusLabel from '../../../components/common/StatusLabel';
import { useCollectionView } from '../../../hooks/useCollectionView';
import {
  formatExpertTaskDateTime,
  formatPercent,
  getExpertTaskDueMeta,
} from '../expertTrainingUtils';
import { findTaskGoldQa, groupTeacherExpertTasks } from '../expertTaskBoardUtils';

const { Paragraph, Text } = Typography;
const FINISHED_STATUSES = new Set(['COMPLETED', 'DONE', 'CANCELLED']);
const TASK_SEARCH_KEYS = ['title', 'chapter', 'instructions', 'status', 'assigneeId'];

function TaskAction({
  task,
  contribution,
  userId,
  pendingAction,
  onClaim,
  onContribute,
  onPreview,
  onViewExam,
}) {
  const isOwner = task.assigneeId === userId;
  const canPreview = Boolean(onPreview);
  const canViewExam = Boolean(contribution && (contribution.examAiAnswer || contribution.goldAnswer || contribution.examScore != null));

  return (
    <Space wrap size={[8, 8]}>
      {canPreview && (
        <ActionButton icon={<Eye size={15} />} onClick={() => onPreview(task)}>Xem giáo trình</ActionButton>
      )}
      {canViewExam && (
        <ActionButton icon={<ShieldCheck size={15} />} onClick={() => onViewExam(contribution)}>
          Xem kết quả chấm
        </ActionButton>
      )}
      {task.status === 'OPEN' && !task.assigneeId ? (
        <ActionButton
          intent="primary"
          loading={pendingAction === `claim-task:${task.id}`}
          disabled={Boolean(pendingAction) || !userId}
          onClick={() => onClaim(task)}
        >
          Nhận và bắt đầu
        </ActionButton>
      ) : isOwner && ['ASSIGNED', 'IN_PROGRESS'].includes(task.status) ? (
        <ActionButton intent="primary" onClick={() => onContribute(task)}>
          {task.status === 'IN_PROGRESS' ? 'Tiếp tục Q&A' : 'Soạn Q&A'}
        </ActionButton>
      ) : isOwner && FINISHED_STATUSES.has(task.status) ? (
        <ActionButton onClick={() => onContribute(task)}>Xem kết quả</ActionButton>
      ) : task.status === 'SUBMITTED' && isOwner ? (
        <Text type="secondary">Đang chờ Senior duyệt</Text>
      ) : task.assigneeId && !isOwner ? (
        <Text type="secondary">Giảng viên khác đang xử lý</Text>
      ) : null}
    </Space>
  );
}

function ContributionState({ contribution }) {
  if (!contribution) return null;
  if (contribution.status === 'REJECTED') {
    return (
      <div className="expert-training__task-result expert-training__task-result--revision">
        <RotateCcw size={17} aria-hidden="true" />
        <div>
          <strong>Senior yêu cầu chỉnh sửa</strong>
          <span>{contribution.rejectionReason || contribution.reviewNote || 'Mở task để xem lại Q&A.'}</span>
        </div>
      </div>
    );
  }
  if (contribution.status === 'INDEXED') {
    return (
      <div className="expert-training__task-result expert-training__task-result--indexed">
        <Database size={17} aria-hidden="true" />
        <div>
          <strong>Senior đã nạp vào RAG</strong>
          <span>Q&A vàng đã trở thành nguồn dùng chung của môn.</span>
        </div>
      </div>
    );
  }
  if (contribution.status === 'PENDING_REVIEW') {
    const passed = contribution.examPassed === true;
    return (
      <div className={`expert-training__task-result expert-training__task-result--${passed ? 'passed' : 'review'}`}>
        <ShieldCheck size={17} aria-hidden="true" />
        <div>
          <strong>
            {passed ? `AI đạt ${formatPercent(contribution.examScore)} · đã gửi Senior` : 'Đã gửi Senior · AI chưa đạt'}
          </strong>
          <span>Đang chờ Senior duyệt nạp RAG. Bấm Xem kết quả chấm để đối chiếu.</span>
        </div>
      </div>
    );
  }
  if (contribution.status === 'EXAMINED') {
    const passed = contribution.examPassed === true;
    return (
      <div className={`expert-training__task-result expert-training__task-result--${passed ? 'passed' : 'review'}`}>
        <ShieldCheck size={17} aria-hidden="true" />
        <div>
          <strong>
            {passed ? `AI đạt ${formatPercent(contribution.examScore)}` : 'AI chưa đạt hoặc cần kiểm tra'}
          </strong>
          <span>Đã chấm bằng giáo trình. Mở task để Thi lại hoặc Gửi Senior duyệt.</span>
        </div>
      </div>
    );
  }
  return null;
}

function TaskCard({ task, contribution, userId, pendingAction, onClaim, onContribute, onPreview, onViewExam }) {
  const dueMeta = getExpertTaskDueMeta(task);
  return (
    <Card className="expert-training__task-card" size="small">
      <div className="expert-training__task-card-head">
        <div className="expert-training__task-card-title">
          <span>Q&A VÀNG · {task.chapter}</span>
          <strong>{task.title || task.chapter}</strong>
        </div>
        <StatusLabel status={task.status} />
      </div>

      <Space wrap size={[6, 6]}>
        <Tag color="blue">Chỉ dùng giáo trình</Tag>
        <Tag>1 câu hỏi + 1 đáp án chuẩn</Tag>
        {Number(task.priority) >= 90 && <Tag color="orange">Ưu tiên cao</Tag>}
      </Space>

      <Paragraph
        className="expert-training__task-instructions"
        ellipsis={{ rows: 3, expandable: 'collapsible', symbol: 'Xem thêm' }}
      >
        {task.instructions || 'Không có hướng dẫn bổ sung.'}
      </Paragraph>

      <div className="expert-training__task-card-meta">
        <span>
          <BookOpenCheck size={15} aria-hidden="true" />
          {task.assigneeId ? (task.assigneeId === userId ? 'Người nhận: Bạn' : 'Người nhận: Giảng viên khác') : 'Chưa có người nhận'}
        </span>
        <span>
          <Clock3 size={15} aria-hidden="true" />
          Giao: {formatExpertTaskDateTime(task.createdAt, '—')}
        </span>
        <span className={`expert-training__task-due expert-training__task-due--${dueMeta.tone}`}>
          <Clock3 size={15} aria-hidden="true" />
          {dueMeta.label}
        </span>
      </div>

      <ContributionState contribution={contribution} />

      <div className="expert-training__task-card-action">
        <TaskAction
          task={task}
          contribution={contribution}
          userId={userId}
          pendingAction={pendingAction}
          onClaim={onClaim}
          onContribute={onContribute}
          onPreview={onPreview}
          onViewExam={onViewExam}
        />
      </div>
    </Card>
  );
}

export default function ExpertTaskBoard({
  tasks = [],
  goldQa = [],
  userId,
  loading,
  error,
  pendingAction,
  onRefresh,
  onClaim,
  onContribute,
  onPreviewTask,
}) {
  const [activeTab, setActiveTab] = useState('TODO');
  const [examContribution, setExamContribution] = useState(null);
  const taskGroups = useMemo(
    () => groupTeacherExpertTasks(tasks, userId),
    [tasks, userId],
  );
  const collection = useCollectionView(taskGroups[activeTab], {
    initialPageSize: 20,
    pageSizeOptions: [10, 20, 50],
    searchKeys: TASK_SEARCH_KEYS,
  });
  const visibleTasks = collection.visibleItems;

  return (
    <section className="expert-training__section" aria-labelledby="tasks-heading">
      <div className="expert-training__section-heading">
        <div>
          <h2 id="tasks-heading">Việc Q&A huấn luyện AI</h2>
          <p>Mỗi task do Senior mở từ một chương đã index và chỉ yêu cầu một Q&A vàng.</p>
        </div>
        <ActionButton icon={<RefreshCw size={16} />} onClick={onRefresh} loading={loading}>
          Làm mới
        </ActionButton>
      </div>

      <Segmented
        className="expert-training__task-tabs"
        value={activeTab}
        onChange={setActiveTab}
        options={[
          { value: 'TODO', label: `Việc mở (${taskGroups.TODO.length})`, icon: <Clock3 size={15} /> },
          { value: 'DOING', label: `Việc của tôi (${taskGroups.DOING.length})`, icon: <Loader2 size={15} /> },
          { value: 'DONE', label: `Đã hoàn tất (${taskGroups.DONE.length})`, icon: <CheckCircle2 size={15} /> },
        ]}
      />

      <CollectionSearch
        query={collection.query}
        onQueryChange={collection.setQuery}
        filteredCount={collection.filteredCount}
        totalCount={collection.totalCount}
        placeholder="Tìm task theo chương, tiêu đề hoặc trạng thái"
      />

      <AsyncState
        loading={loading && !tasks.length}
        error={error}
        empty={!loading && !error && !visibleTasks.length}
        emptyTitle={
          activeTab === 'TODO'
            ? 'Senior chưa mở task mới'
            : activeTab === 'DOING'
              ? 'Bạn chưa nhận task nào'
              : 'Chưa có Q&A được Senior xử lý xong'
        }
        emptyDescription={
          activeTab === 'TODO'
            ? 'Khi Senior bấm Bắt đầu chương trên mục lục, task GOLD_QA sẽ xuất hiện ở đây.'
            : activeTab === 'DOING'
              ? 'Task đang soạn, được trả lại hoặc đang chờ Senior duyệt sẽ nằm tại đây.'
              : 'Q&A được nạp RAG hoặc task đã đóng sẽ xuất hiện tại đây.'
        }
        onRetry={onRefresh}
      >
        <div className="expert-training__task-grid">
          {visibleTasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              contribution={findTaskGoldQa(task, goldQa)}
              userId={userId}
              pendingAction={pendingAction}
              onClaim={onClaim}
              onContribute={onContribute}
              onPreview={onPreviewTask}
              onViewExam={setExamContribution}
            />
          ))}
        </div>
      </AsyncState>
      <CollectionPagination collection={collection} />
      <Modal
        open={Boolean(examContribution)}
        title="Kết quả chấm"
        footer={null}
        width={800}
        className="expert-exam-chat-modal"
        onCancel={() => setExamContribution(null)}
        destroyOnHidden
      >
        {examContribution && (
          <GoldQaExamCompare contribution={examContribution} />
        )}
      </Modal>
    </section>
  );
}
