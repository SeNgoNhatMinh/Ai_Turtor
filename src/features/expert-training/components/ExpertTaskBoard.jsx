import { useMemo, useState } from 'react';
import { Button, Card, Segmented, Space, Tag, Typography } from 'antd';
import { BookOpenCheck, CheckCircle2, Clock3, RefreshCw } from 'lucide-react';
import AsyncState from '../../../components/common/AsyncState';
import StatusLabel from '../../../components/common/StatusLabel';
import { getTaskGoldUsage } from '../expertTrainingUtils';

const { Paragraph, Text } = Typography;
const ACTIVE_STATUSES = new Set(['OPEN', 'ASSIGNED', 'IN_PROGRESS', 'SUBMITTED']);
const FINISHED_STATUSES = new Set(['COMPLETED', 'DONE', 'CANCELLED']);
const CONTRIBUTION_TYPES = new Set(['GOLD_QA', 'RUBRIC']);

const asTimestamp = (value) => {
  const timestamp = new Date(value || 0).getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
};

const sortTasks = (left, right) => (
  Number(right.priority || 0) - Number(left.priority || 0)
  || asTimestamp(right.updatedAt || right.createdAt) - asTimestamp(left.updatedAt || left.createdAt)
);

const formatDate = (value) => {
  if (!value) return 'Không có hạn';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Không có hạn' : date.toLocaleString('vi-VN');
};

function TaskAction({ task, userId, pendingAction, onClaim, onContribute }) {
  const isOwner = task.assigneeId === userId;
  const isContributionTask = CONTRIBUTION_TYPES.has(task.type);

  if (task.status === 'OPEN' && !task.assigneeId) {
    return (
      <Button
        type="primary"
        loading={pendingAction === `claim-task:${task.id}`}
        disabled={Boolean(pendingAction) || !userId}
        onClick={() => onClaim(task)}
      >
        Nhận task
      </Button>
    );
  }

  if (isOwner && isContributionTask && ['ASSIGNED', 'IN_PROGRESS'].includes(task.status)) {
    return <Button type="primary" onClick={() => onContribute(task)}>Đóng góp</Button>;
  }

  if (isOwner && isContributionTask && FINISHED_STATUSES.has(task.status)) {
    return <Button onClick={() => onContribute(task)}>Xem nội dung</Button>;
  }

  if (task.status === 'SUBMITTED' && isOwner) {
    return <Text type="secondary">Đang chờ Senior duyệt</Text>;
  }

  if (task.assigneeId && !isOwner) {
    return <Text type="secondary">Giảng viên khác đang xử lý</Text>;
  }

  return null;
}

function TaskCard({ task, userId, pendingAction, onClaim, onContribute }) {
  const usage = getTaskGoldUsage(task);
  return (
    <Card className="expert-training__task-card" size="small">
      <div className="expert-training__task-card-head">
        <div className="expert-training__task-card-title">
          <span>{task.type === 'RUBRIC' ? 'Rubric' : 'Gold Q&A'}</span>
          <strong>{task.title || task.chapter}</strong>
        </div>
        <StatusLabel status={task.status} />
      </div>

      <Space wrap size={[6, 6]}>
        {usage && (
          <Tag color={usage === 'EVALUATION' ? 'purple' : 'blue'}>
            {usage === 'EVALUATION' ? 'EVALUATION · holdout' : 'TRAINING · vào RAG sau duyệt'}
          </Tag>
        )}
        <Tag>{task.chapter}</Tag>
        <Tag>Ưu tiên {task.priority}</Tag>
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
          {formatDate(task.dueAt)}
        </span>
      </div>

      <div className="expert-training__task-card-action">
        <TaskAction
          task={task}
          userId={userId}
          pendingAction={pendingAction}
          onClaim={onClaim}
          onContribute={onContribute}
        />
      </div>
    </Card>
  );
}

export default function ExpertTaskBoard({
  tasks = [],
  userId,
  loading,
  error,
  pendingAction,
  onRefresh,
  onClaim,
  onContribute,
}) {
  const [activeTab, setActiveTab] = useState('TODO');
  const taskGroups = useMemo(() => {
    const visible = tasks.filter((task) => (
      task.status === 'OPEN'
      || task.assigneeId === userId
      || (!task.assigneeId && ACTIVE_STATUSES.has(task.status))
    ));
    return {
      TODO: visible.filter((task) => ACTIVE_STATUSES.has(task.status)).sort(sortTasks),
      DONE: visible.filter((task) => FINISHED_STATUSES.has(task.status)).sort(sortTasks),
    };
  }, [tasks, userId]);
  const visibleTasks = taskGroups[activeTab];

  return (
    <section className="expert-training__section" aria-labelledby="tasks-heading">
      <div className="expert-training__section-heading">
        <div>
          <h2 id="tasks-heading">Công việc tri thức AI</h2>
          <p>Nhận task mở, đọc học liệu chương và gửi Gold Q&A hoặc Rubric để Senior kiểm duyệt.</p>
        </div>
        <Button icon={<RefreshCw size={16} />} onClick={onRefresh} loading={loading}>
          Làm mới
        </Button>
      </div>

      <Segmented
        value={activeTab}
        onChange={setActiveTab}
        options={[
          { value: 'TODO', label: `Cần làm (${taskGroups.TODO.length})`, icon: <Clock3 size={15} /> },
          { value: 'DONE', label: `Đã xong (${taskGroups.DONE.length})`, icon: <CheckCircle2 size={15} /> },
        ]}
      />

      <AsyncState
        loading={loading && !tasks.length}
        error={error}
        empty={!loading && !error && !visibleTasks.length}
        emptyTitle={activeTab === 'TODO' ? 'Không có task đang mở' : 'Chưa có task hoàn thành'}
        emptyDescription={activeTab === 'TODO'
          ? 'Senior chạy Coverage Analyze để tạo task Training hoặc Evaluation.'
          : 'Task được Senior duyệt hoàn tất sẽ xuất hiện tại đây.'}
        onRetry={onRefresh}
      >
        <div className="expert-training__task-grid">
          {visibleTasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              userId={userId}
              pendingAction={pendingAction}
              onClaim={onClaim}
              onContribute={onContribute}
            />
          ))}
        </div>
      </AsyncState>
    </section>
  );
}
