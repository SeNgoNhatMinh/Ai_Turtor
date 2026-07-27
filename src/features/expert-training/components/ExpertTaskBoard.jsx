import { useMemo, useState } from 'react';
import { Button, Card, Segmented, Space, Tag, Typography } from 'antd';
import { BookOpenCheck, CheckCircle2, Clock3, Eye, Loader2, RefreshCw } from 'lucide-react';
import AsyncState from '../../../components/common/AsyncState';
import StatusLabel from '../../../components/common/StatusLabel';
import {
  formatExpertTaskDateTime,
  getExpertTaskDueMeta,
  getTaskGoldUsage,
} from '../expertTrainingUtils';
import { groupTeacherExpertTasks } from '../expertTaskBoardUtils';

const { Paragraph, Text } = Typography;
const FINISHED_STATUSES = new Set(['COMPLETED', 'DONE', 'CANCELLED']);
const CONTRIBUTION_TYPES = new Set(['GOLD_QA', 'RUBRIC']);

function TaskAction({ task, userId, pendingAction, onClaim, onContribute, onPreview }) {
  const isOwner = task.assigneeId === userId;
  const isContributionTask = CONTRIBUTION_TYPES.has(task.type);
  const canPreview = Boolean(onPreview);

  return (
    <Space wrap size={[8, 8]}>
      {canPreview && (
        <Button icon={<Eye size={15} />} onClick={() => onPreview(task)}>
          Xem trước
        </Button>
      )}
      {task.status === 'OPEN' && !task.assigneeId ? (
        <Button
          type="primary"
          loading={pendingAction === `claim-task:${task.id}`}
          disabled={Boolean(pendingAction) || !userId}
          onClick={() => onClaim(task)}
        >
          Nhận task
        </Button>
      ) : isOwner && isContributionTask && ['ASSIGNED', 'IN_PROGRESS'].includes(task.status) ? (
        <Button type="primary" onClick={() => onContribute(task)}>Đóng góp</Button>
      ) : isOwner && isContributionTask && FINISHED_STATUSES.has(task.status) ? (
        <Button onClick={() => onContribute(task)}>Xem nội dung</Button>
      ) : task.status === 'SUBMITTED' && isOwner ? (
        <Text type="secondary">Đang chờ Senior duyệt</Text>
      ) : task.assigneeId && !isOwner ? (
        <Text type="secondary">Giảng viên khác đang xử lý</Text>
      ) : null}
    </Space>
  );
}

function TaskCard({ task, userId, pendingAction, onClaim, onContribute, onPreview }) {
  const usage = getTaskGoldUsage(task);
  const dueMeta = getExpertTaskDueMeta(task);
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
          Giao: {formatExpertTaskDateTime(task.createdAt, '—')}
        </span>
        <span className={`expert-training__task-due expert-training__task-due--${dueMeta.tone}`}>
          <Clock3 size={15} aria-hidden="true" />
          {dueMeta.label}
        </span>
      </div>

      <div className="expert-training__task-card-action">
        <TaskAction
          task={task}
          userId={userId}
          pendingAction={pendingAction}
          onClaim={onClaim}
          onContribute={onContribute}
          onPreview={onPreview}
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
  onPreviewTask,
}) {
  const [activeTab, setActiveTab] = useState('TODO');
  const taskGroups = useMemo(
    () => groupTeacherExpertTasks(tasks, userId),
    [tasks, userId],
  );
  const visibleTasks = taskGroups[activeTab];

  return (
    <section className="expert-training__section" aria-labelledby="tasks-heading">
      <div className="expert-training__section-heading">
        <div>
          <h2 id="tasks-heading">Công việc tri thức AI</h2>
          <p>Xem trước tài liệu chương, kiểm tra hạn Senior giao, rồi nhận task và đóng góp Gold Q&A hoặc Rubric.</p>
        </div>
        <Button icon={<RefreshCw size={16} />} onClick={onRefresh} loading={loading}>
          Làm mới
        </Button>
      </div>

      <Segmented
        className="expert-training__task-tabs"
        value={activeTab}
        onChange={setActiveTab}
        options={[
          { value: 'TODO', label: `Cần làm (${taskGroups.TODO.length})`, icon: <Clock3 size={15} /> },
          { value: 'DOING', label: `Đang làm (${taskGroups.DOING.length})`, icon: <Loader2 size={15} /> },
          { value: 'DONE', label: `Đã xong (${taskGroups.DONE.length})`, icon: <CheckCircle2 size={15} /> },
        ]}
      />

      <AsyncState
        loading={loading && !tasks.length}
        error={error}
        empty={!loading && !error && !visibleTasks.length}
        emptyTitle={
          activeTab === 'TODO'
            ? 'Không có task đang mở'
            : activeTab === 'DOING'
              ? 'Chưa có công việc đang làm'
              : 'Chưa có task hoàn thành'
        }
        emptyDescription={
          activeTab === 'TODO'
            ? 'Senior chạy Coverage Analyze hoặc tạo task theo chương.'
            : activeTab === 'DOING'
              ? 'Task bạn đã nhận (đang soạn, chỉnh sửa hoặc chờ Senior duyệt) sẽ hiện tại đây.'
              : 'Task được Senior duyệt hoàn tất sẽ xuất hiện tại đây.'
        }
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
              onPreview={onPreviewTask}
            />
          ))}
        </div>
      </AsyncState>
    </section>
  );
}
