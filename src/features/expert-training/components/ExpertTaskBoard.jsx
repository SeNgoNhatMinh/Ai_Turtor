import { useMemo, useState } from 'react';
import {
  Button,
  DatePicker,
  Form,
  Input,
  InputNumber,
  Modal,
  Select,
  Space,
  Table,
  Tag,
} from 'antd';
import { Plus, RefreshCw } from 'lucide-react';
import AsyncState from '../../../components/common/AsyncState';
import StatusLabel from '../../../components/common/StatusLabel';
import { getStatusLabel } from '../../../utils/statusLabels';

const TASK_STATUSES = ['ALL', 'OPEN', 'ASSIGNED', 'IN_PROGRESS', 'SUBMITTED', 'COMPLETED', 'CANCELLED'];
const CONTRIBUTION_TYPES = new Set(['GOLD_QA', 'RUBRIC']);

const formatDate = (value) => {
  if (!value) return 'Không có hạn';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Không có hạn' : date.toLocaleString('vi-VN');
};

export default function ExpertTaskBoard({
  tasks,
  selectedTask,
  draftChapter,
  userId,
  canReview,
  loading,
  error,
  pendingAction,
  onRefresh,
  onClaim,
  onCreate,
  onContribute,
  onDraftConsumed,
}) {
  const [status, setStatus] = useState('ALL');
  const [scope, setScope] = useState('AVAILABLE');
  const [createOpen, setCreateOpen] = useState(false);
  const [form] = Form.useForm();
  const createTaskType = Form.useWatch('type', form);
  const createModalOpen = createOpen || Boolean(draftChapter);

  const filteredTasks = useMemo(() => tasks.filter((task) => {
    if (status !== 'ALL' && task.status !== status) return false;
    if (scope === 'MINE') return task.assigneeId === userId;
    if (scope === 'AVAILABLE') return task.status === 'OPEN' || task.assigneeId === userId;
    return true;
  }), [scope, status, tasks, userId]);

  const submitCreate = async (values) => {
    const { usage, instructions, ...taskValues } = values;
    const usageInstruction = taskValues.type === 'GOLD_QA'
      ? usage === 'EVALUATION'
        ? 'Mục đích bắt buộc: EVALUATION holdout, không index RAG.'
        : 'Mục đích bắt buộc: TRAINING, chỉ index RAG sau khi được duyệt.'
      : '';
    const result = await onCreate({
      ...taskValues,
      instructions: [usageInstruction, String(instructions || '').trim()].filter(Boolean).join('\n'),
      dueAt: values.dueAt?.toISOString?.() || null,
    });
    if (result) {
      setCreateOpen(false);
      onDraftConsumed?.();
      form.resetFields();
    }
  };

  const closeCreateModal = () => {
    setCreateOpen(false);
    onDraftConsumed?.();
    form.resetFields();
  };

  const columns = [
    {
      title: 'Công việc',
      dataIndex: 'title',
      key: 'title',
      width: 280,
      render: (value, task) => (
        <div className="expert-training__primary-cell">
          <strong>{value}</strong>
          <span>{task.chapter}</span>
          {task.instructions && <span className="expert-training__clamp-two">{task.instructions}</span>}
        </div>
      ),
    },
    {
      title: 'Loại đóng góp',
      dataIndex: 'type',
      key: 'type',
      width: 125,
      render: (value) => <Tag>{value.replaceAll('_', ' ')}</Tag>,
    },
    {
      title: 'Ưu tiên',
      dataIndex: 'priority',
      key: 'priority',
      width: 90,
      align: 'center',
      sorter: (a, b) => a.priority - b.priority,
    },
    {
      title: 'Trạng thái',
      dataIndex: 'status',
      key: 'status',
      width: 125,
      render: (value) => <StatusLabel status={value} />,
    },
    {
      title: 'Người phụ trách',
      dataIndex: 'assigneeId',
      key: 'owner',
      width: 120,
      render: (value) => value ? (value === userId ? 'Bạn' : 'Giảng viên khác') : 'Chưa giao',
    },
    {
      title: 'Hạn hoàn thành',
      dataIndex: 'dueAt',
      key: 'dueAt',
      width: 160,
      render: formatDate,
    },
    {
      title: '',
      key: 'action',
      fixed: 'right',
      width: 130,
      render: (_, task) => {
        if (task.status === 'OPEN') {
          return (
            <Button
              size="small"
              loading={pendingAction === `claim-task:${task.id}`}
              disabled={Boolean(pendingAction) || !userId}
              onClick={() => onClaim(task)}
            >
              Nhận việc
            </Button>
          );
        }
        if (
          task.assigneeId === userId
          && CONTRIBUTION_TYPES.has(task.type)
          && ['ASSIGNED', 'IN_PROGRESS'].includes(task.status)
        ) {
          return (
            <Button size="small" type="primary" onClick={() => onContribute(task)}>
              Thực hiện
            </Button>
          );
        }
        if (
          task.assigneeId === userId
          && CONTRIBUTION_TYPES.has(task.type)
          && ['SUBMITTED', 'COMPLETED'].includes(task.status)
        ) {
          return <Button size="small" onClick={() => onContribute(task)}>Xem</Button>;
        }
        return null;
      },
    },
  ];

  return (
    <section className="expert-training__section" aria-labelledby="tasks-heading">
      <div className="expert-training__section-heading">
        <div>
          <h2 id="tasks-heading">Công việc chuyên gia</h2>
          <p>Nhận task, chuẩn bị Gold Q&A hoặc Rubric và gửi kiểm duyệt độc lập.</p>
        </div>
        <Space wrap>
          <Button icon={<RefreshCw size={16} />} onClick={onRefresh} loading={loading}>Làm mới</Button>
          {canReview && (
            <Button type="primary" icon={<Plus size={16} />} onClick={() => setCreateOpen(true)}>Tạo công việc</Button>
          )}
        </Space>
      </div>

      <div className="expert-training__filters">
        <Select
          aria-label="Phạm vi công việc"
          value={scope}
          onChange={setScope}
          options={[
            { value: 'AVAILABLE', label: 'Có thể nhận và của tôi' },
            { value: 'MINE', label: 'Công việc của tôi' },
            { value: 'ALL', label: 'Tất cả công việc' },
          ]}
          className="expert-training__filter-control"
        />
        <Select
          aria-label="Trạng thái công việc"
          value={status}
          onChange={setStatus}
          options={TASK_STATUSES.map((value) => ({
            value,
            label: value === 'ALL' ? 'Tất cả trạng thái' : getStatusLabel(value),
          }))}
          className="expert-training__filter-control"
        />
        <span className="expert-training__filter-count">{filteredTasks.length} công việc</span>
      </div>

      <AsyncState
        loading={loading && !tasks.length}
        error={error}
        empty={!loading && !error && !filteredTasks.length}
        emptyTitle="Không có công việc phù hợp"
        emptyDescription="Hãy đổi bộ lọc hoặc tạo công việc bổ sung tri thức mới."
        onRetry={onRefresh}
      >
        <Table
          rowKey="id"
          columns={columns}
          dataSource={filteredTasks}
          rowClassName={(task) => task.id === selectedTask?.id ? 'expert-training__table-row--selected' : ''}
          pagination={{ pageSize: 10, hideOnSinglePage: true }}
          scroll={{ x: 1100 }}
          size="middle"
        />
      </AsyncState>

      <Modal
        title="Tạo công việc chuyên gia"
        open={createModalOpen}
        onCancel={closeCreateModal}
        onOk={() => form.submit()}
        okText="Tạo công việc"
        confirmLoading={pendingAction === 'create-task'}
        destroyOnHidden
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={submitCreate}
          key={draftChapter || 'manual-task'}
          initialValues={{
            type: 'GOLD_QA',
            usage: 'TRAINING',
            priority: 50,
            chapter: draftChapter || undefined,
            title: draftChapter ? `Bổ sung tri thức cho ${draftChapter}` : undefined,
          }}
          className="expert-training__modal-form"
        >
          <Form.Item label="Tiêu đề" name="title" rules={[{ required: true, whitespace: true }]}>
            <Input maxLength={255} placeholder="Chuẩn bị Gold Q&A về Dependency Injection" />
          </Form.Item>
          <Form.Item label="Chương" name="chapter" rules={[{ required: true, whitespace: true }]}>
            <Input maxLength={255} />
          </Form.Item>
          <Form.Item label="Loại công việc" name="type" rules={[{ required: true }]}>
            <Select options={[
              { value: 'GOLD_QA', label: 'Gold Q&A' },
              { value: 'RUBRIC', label: 'Rubric' },
            ]} />
          </Form.Item>
          {createTaskType === 'GOLD_QA' && (
            <Form.Item
              label="Mục đích Gold Q&A"
              name="usage"
              rules={[{ required: true, message: 'Chọn mục đích của Gold Q&A.' }]}
            >
              <Select options={[
                { value: 'TRAINING', label: 'TRAINING — đưa vào RAG sau khi duyệt' },
                { value: 'EVALUATION', label: 'EVALUATION — holdout, không index RAG' },
              ]} />
            </Form.Item>
          )}
          <Form.Item label="Mức ưu tiên" name="priority">
            <InputNumber min={1} max={100} precision={0} className="expert-training__full-width" />
          </Form.Item>
          <Form.Item label="Hướng dẫn" name="instructions">
            <Input.TextArea rows={4} maxLength={5000} />
          </Form.Item>
          <Form.Item label="Hạn hoàn thành" name="dueAt">
            <DatePicker showTime className="expert-training__full-width" />
          </Form.Item>
        </Form>
      </Modal>
    </section>
  );
}
