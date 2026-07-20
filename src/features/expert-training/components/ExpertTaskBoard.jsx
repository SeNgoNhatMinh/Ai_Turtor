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
import { getEntityStatusColor } from '../expertTrainingUtils';

const TASK_STATUSES = ['ALL', 'OPEN', 'ASSIGNED', 'IN_PROGRESS', 'SUBMITTED', 'COMPLETED', 'CANCELLED'];
const CONTRIBUTION_TYPES = new Set(['GOLD_QA', 'RUBRIC']);

const formatDate = (value) => {
  if (!value) return 'No deadline';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'No deadline' : date.toLocaleString();
};

export default function ExpertTaskBoard({
  tasks,
  userId,
  loading,
  error,
  pendingAction,
  onRefresh,
  onClaim,
  onCreate,
  onContribute,
}) {
  const [status, setStatus] = useState('ALL');
  const [scope, setScope] = useState('AVAILABLE');
  const [createOpen, setCreateOpen] = useState(false);
  const [form] = Form.useForm();

  const filteredTasks = useMemo(() => tasks.filter((task) => {
    if (status !== 'ALL' && task.status !== status) return false;
    if (scope === 'MINE') return task.assigneeId === userId;
    if (scope === 'AVAILABLE') return task.status === 'OPEN' || task.assigneeId === userId;
    return true;
  }), [scope, status, tasks, userId]);

  const submitCreate = async (values) => {
    const result = await onCreate({
      ...values,
      dueAt: values.dueAt?.toISOString?.() || null,
    });
    if (result) {
      setCreateOpen(false);
      form.resetFields();
    }
  };

  const columns = [
    {
      title: 'Task',
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
      title: 'Contribution',
      dataIndex: 'type',
      key: 'type',
      width: 125,
      render: (value) => <Tag>{value.replaceAll('_', ' ')}</Tag>,
    },
    {
      title: 'Priority',
      dataIndex: 'priority',
      key: 'priority',
      width: 90,
      align: 'center',
      sorter: (a, b) => a.priority - b.priority,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 125,
      render: (value) => <Tag color={getEntityStatusColor(value)}>{value.replaceAll('_', ' ')}</Tag>,
    },
    {
      title: 'Owner',
      dataIndex: 'assigneeId',
      key: 'owner',
      width: 120,
      render: (value) => value ? (value === userId ? 'You' : 'Assigned teacher') : 'Unassigned',
    },
    {
      title: 'Due',
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
              Claim
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
              Contribute
            </Button>
          );
        }
        return null;
      },
    },
  ];

  return (
    <section className="expert-training__section" aria-labelledby="tasks-heading">
      <div className="expert-training__section-heading">
        <div>
          <h2 id="tasks-heading">Expert Task Board</h2>
          <p>Claim a trusted-content task, prepare the contribution, and submit it for independent review.</p>
        </div>
        <Space wrap>
          <Button icon={<RefreshCw size={16} />} onClick={onRefresh} loading={loading}>Refresh</Button>
          <Button type="primary" icon={<Plus size={16} />} onClick={() => setCreateOpen(true)}>Create task</Button>
        </Space>
      </div>

      <div className="expert-training__filters">
        <Select
          aria-label="Task scope"
          value={scope}
          onChange={setScope}
          options={[
            { value: 'AVAILABLE', label: 'Available and my tasks' },
            { value: 'MINE', label: 'My tasks' },
            { value: 'ALL', label: 'All course tasks' },
          ]}
          className="expert-training__filter-control"
        />
        <Select
          aria-label="Task status"
          value={status}
          onChange={setStatus}
          options={TASK_STATUSES.map((value) => ({ value, label: value.replaceAll('_', ' ') }))}
          className="expert-training__filter-control"
        />
        <span className="expert-training__filter-count">{filteredTasks.length} tasks</span>
      </div>

      <AsyncState
        loading={loading && !tasks.length}
        error={error}
        empty={!loading && !error && !filteredTasks.length}
        emptyTitle="No tasks match this view"
        emptyDescription="Change the filters or create a focused expert contribution task."
        onRetry={onRefresh}
      >
        <Table
          rowKey="id"
          columns={columns}
          dataSource={filteredTasks}
          pagination={{ pageSize: 10, hideOnSinglePage: true }}
          scroll={{ x: 1100 }}
          size="middle"
        />
      </AsyncState>

      <Modal
        title="Create expert task"
        open={createOpen}
        onCancel={() => setCreateOpen(false)}
        onOk={() => form.submit()}
        okText="Create task"
        confirmLoading={pendingAction === 'create-task'}
        destroyOnHidden
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={submitCreate}
          initialValues={{ type: 'GOLD_QA', priority: 50 }}
          className="expert-training__modal-form"
        >
          <Form.Item label="Title" name="title" rules={[{ required: true, whitespace: true }]}>
            <Input maxLength={255} placeholder="Prepare Gold Q&A for dependency injection" />
          </Form.Item>
          <Form.Item label="Chapter" name="chapter" rules={[{ required: true, whitespace: true }]}>
            <Input maxLength={255} />
          </Form.Item>
          <Form.Item label="Task type" name="type" rules={[{ required: true }]}>
            <Select options={[
              { value: 'GOLD_QA', label: 'Gold Q&A' },
              { value: 'RUBRIC', label: 'Rubric' },
            ]} />
          </Form.Item>
          <Form.Item label="Priority" name="priority">
            <InputNumber min={1} max={100} precision={0} className="expert-training__full-width" />
          </Form.Item>
          <Form.Item label="Instructions" name="instructions">
            <Input.TextArea rows={4} maxLength={5000} />
          </Form.Item>
          <Form.Item label="Due date" name="dueAt">
            <DatePicker showTime className="expert-training__full-width" />
          </Form.Item>
        </Form>
      </Modal>
    </section>
  );
}
