import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Descriptions,
  Drawer,
  Form,
  Input,
  InputNumber,
  Modal,
  Select,
  Space,
  Table,
  Tag,
} from 'antd';
import { Eye, Pencil, Plus, RefreshCw, Search, Trash2 } from 'lucide-react';
import ActionButton from '../../../components/common/ActionButton';
import AsyncState from '../../../components/common/AsyncState';
import EntityActionMenu from '../../../components/common/EntityActionMenu';
import StatusLabel from '../../../components/common/StatusLabel';
import { confirmDanger } from '../../../components/common/confirmDialog';
import { expertTrainingApi } from '../../../services/expertTrainingApi';
import { getUserFacingError } from '../../../services/httpClient';
import { formatExpertTaskDateTime } from '../expertTrainingUtils';
import '../styles/expert-task-management.css';

const TASK_STATUSES = ['OPEN', 'ASSIGNED', 'IN_PROGRESS', 'SUBMITTED', 'COMPLETED', 'CANCELLED'];
const DEFAULT_PAGE_SIZE = 20;

function toDateTimeLocal(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 16);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function taskTitleForChapter(chapter) {
  return chapter ? `Q&A vàng — ${chapter}` : '';
}

export default function SeniorTaskManagement({
  courseId,
  chapters = [],
  currentUser,
  triggerToast,
}) {
  const [form] = Form.useForm();
  const requestSequence = useRef(0);
  const [rows, setRows] = useState([]);
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [status, setStatus] = useState('ALL');
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [editor, setEditor] = useState(null);
  const [saving, setSaving] = useState(false);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQuery(query.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [query]);

  const loadTasks = useCallback(async () => {
    if (!courseId) {
      setRows([]);
      setTotal(0);
      return;
    }
    const sequence = requestSequence.current + 1;
    requestSequence.current = sequence;
    setLoading(true);
    setError('');
    try {
      const result = await expertTrainingApi.searchTasks({
        courseId,
        type: 'GOLD_QA',
        status: status === 'ALL' ? '' : status,
        query: debouncedQuery,
        page,
        size: pageSize,
        sortBy: 'updatedAt',
        sortDirection: 'desc',
      });
      if (requestSequence.current !== sequence) return;
      setRows(result.tasks);
      setTotal(result.totalElements);
      if (result.totalElements > 0 && page >= result.totalPages) {
        setPage(Math.max(0, result.totalPages - 1));
      }
    } catch (loadError) {
      if (requestSequence.current !== sequence) return;
      setRows([]);
      setTotal(0);
      setError(getUserFacingError(loadError, 'Không thể tải danh sách task.'));
    } finally {
      if (requestSequence.current === sequence) setLoading(false);
    }
  }, [courseId, debouncedQuery, page, pageSize, status]);

  useEffect(() => {
    const timer = window.setTimeout(loadTasks, 0);
    return () => window.clearTimeout(timer);
  }, [loadTasks]);

  const chapterOptions = useMemo(() => chapters
    .filter((chapter) => Number(chapter.chunkCount) > 0 && chapter.status !== 'IGNORED')
    .map((chapter) => ({ value: chapter.title, label: chapter.title })), [chapters]);

  const openCreate = () => {
    setEditor({ mode: 'create', task: null });
    form.resetFields();
    form.setFieldsValue({ priority: 80, status: 'OPEN', dueAt: '' });
  };

  const openEdit = (task) => {
    setEditor({ mode: 'edit', task });
    form.setFieldsValue({
      chapter: task.chapter,
      title: task.title,
      instructions: task.instructions,
      priority: task.priority,
      dueAt: toDateTimeLocal(task.dueAt),
      status: task.status,
      assigneeId: task.assigneeId || '',
    });
  };

  const openDetail = async (task) => {
    setDetail(task);
    setDetailLoading(true);
    try {
      setDetail(await expertTrainingApi.getTask(task.id));
    } catch (detailError) {
      triggerToast?.(getUserFacingError(detailError, 'Không thể tải chi tiết task.'));
    } finally {
      setDetailLoading(false);
    }
  };

  const saveTask = async () => {
    const values = await form.validateFields();
    setSaving(true);
    try {
      if (editor.mode === 'create') {
        await expertTrainingApi.createTask({
          courseId,
          chapter: values.chapter,
          type: 'GOLD_QA',
          title: values.title,
          instructions: values.instructions || '',
          priority: values.priority,
          dueAt: values.dueAt || null,
          createdBy: currentUser?.userId || currentUser?.id || '',
        });
        triggerToast?.('Đã tạo task Q&A vàng.');
      } else {
        await expertTrainingApi.updateTask(editor.task.id, {
          title: values.title,
          instructions: values.instructions || '',
          priority: values.priority,
          dueAt: values.dueAt || null,
          status: values.status,
          assigneeId: values.assigneeId || '',
          assigneeTier: values.assigneeId ? 'TEACHER' : '',
        });
        triggerToast?.('Đã cập nhật task.');
      }
      setEditor(null);
      await loadTasks();
    } catch (saveError) {
      if (saveError?.errorFields) return;
      triggerToast?.(getUserFacingError(saveError, 'Không thể lưu task.'));
    } finally {
      setSaving(false);
    }
  };

  const deleteTask = (task) => {
    confirmDanger({
      title: 'Xóa task này?',
      content: task.contributionId
        ? 'Task đã có bài nộp nên không thể xóa. Hãy hoàn tất quy trình kiểm duyệt.'
        : 'Task sẽ bị xóa khỏi hàng việc của Teacher. Thao tác này không thể hoàn tác.',
      okText: 'Xóa task',
      cancelText: 'Hủy',
      onOk: async () => {
        if (task.contributionId) return;
        try {
          await expertTrainingApi.deleteTask(task.id);
          triggerToast?.('Đã xóa task.');
          await loadTasks();
        } catch (deleteError) {
          triggerToast?.(getUserFacingError(deleteError, 'Không thể xóa task.'));
        }
      },
    });
  };

  const columns = [
    {
      title: 'Task',
      key: 'task',
      width: 360,
      render: (_, task) => (
        <button type="button" className="expert-task-manager__title" onClick={() => openDetail(task)}>
          <strong>{task.title}</strong>
          <span>{task.chapter}</span>
        </button>
      ),
    },
    {
      title: 'Trạng thái',
      dataIndex: 'status',
      width: 145,
      render: (value) => <StatusLabel status={value} />,
    },
    {
      title: 'Người nhận',
      dataIndex: 'assigneeId',
      width: 220,
      render: (value) => value || <Tag>Chưa nhận</Tag>,
    },
    {
      title: 'Ưu tiên',
      dataIndex: 'priority',
      width: 100,
      render: (value) => <Tag color={Number(value) >= 90 ? 'orange' : 'blue'}>{value}</Tag>,
    },
    {
      title: 'Hạn xử lý',
      dataIndex: 'dueAt',
      width: 170,
      render: (value) => formatExpertTaskDateTime(value, 'Không đặt hạn'),
    },
    {
      title: 'Cập nhật',
      dataIndex: 'updatedAt',
      width: 170,
      render: (value) => formatExpertTaskDateTime(value, '—'),
    },
    {
      title: '',
      key: 'actions',
      fixed: 'right',
      width: 64,
      render: (_, task) => (
        <EntityActionMenu
          ariaLabel={`Thao tác task ${task.title}`}
          items={[
            { key: 'view', label: 'Xem chi tiết', icon: <Eye size={15} /> },
            { key: 'edit', label: 'Chỉnh sửa', icon: <Pencil size={15} /> },
            { key: 'delete', label: 'Xóa task', icon: <Trash2 size={15} />, danger: true, disabled: Boolean(task.contributionId) },
          ]}
          onAction={(action) => {
            if (action === 'view') openDetail(task);
            if (action === 'edit') openEdit(task);
            if (action === 'delete') deleteTask(task);
          }}
        />
      ),
    },
  ];

  return (
    <section className="expert-training__section expert-task-manager" aria-labelledby="task-manager-heading">
      <div className="expert-training__section-heading">
        <div>
          <h2 id="task-manager-heading">Quản lý task Q&A vàng</h2>
          <p>Search và phân trang ở server; chỉ tải tối đa 100 task mỗi trang.</p>
        </div>
        <Space wrap>
          <ActionButton icon={<RefreshCw size={16} />} onClick={loadTasks} loading={loading}>Làm mới</ActionButton>
          <ActionButton intent="primary" icon={<Plus size={16} />} onClick={openCreate}>Tạo task</ActionButton>
        </Space>
      </div>

      <div className="expert-task-manager__toolbar">
        <Input
          allowClear
          prefix={<Search size={15} aria-hidden="true" />}
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setPage(0);
          }}
          placeholder="Tìm tiêu đề, chương, hướng dẫn hoặc người nhận..."
          aria-label="Tìm task"
        />
        <Select
          value={status}
          onChange={(value) => {
            setStatus(value);
            setPage(0);
          }}
          aria-label="Lọc trạng thái task"
          options={[
            { value: 'ALL', label: 'Tất cả trạng thái' },
            ...TASK_STATUSES.map((value) => ({ value, label: value })),
          ]}
        />
        <span>{total.toLocaleString('vi-VN')} task</span>
      </div>

      <AsyncState error={error} onRetry={loadTasks}>
        <Table
          rowKey="id"
          className="expert-task-manager__table"
          columns={columns}
          dataSource={rows}
          loading={loading}
          sticky
          scroll={{ x: 1230, y: 520 }}
          locale={{ emptyText: debouncedQuery || status !== 'ALL' ? 'Không tìm thấy task phù hợp.' : 'Chưa có task.' }}
          pagination={{
            current: page + 1,
            pageSize,
            total,
            showSizeChanger: true,
            pageSizeOptions: [20, 50, 100],
            showTotal: (value, range) => `${range[0]}–${range[1]} / ${value}`,
            onChange: (nextPage, nextSize) => {
              setPage(nextSize !== pageSize ? 0 : nextPage - 1);
              setPageSize(nextSize);
            },
          }}
        />
      </AsyncState>

      <Modal
        title={editor?.mode === 'create' ? 'Tạo task Q&A vàng' : 'Chỉnh sửa task'}
        open={Boolean(editor)}
        onCancel={() => setEditor(null)}
        onOk={saveTask}
        okText={editor?.mode === 'create' ? 'Tạo task' : 'Lưu thay đổi'}
        cancelText="Hủy"
        confirmLoading={saving}
        destroyOnHidden
        width={680}
      >
        <Form form={form} layout="vertical" preserve={false}>
          <Form.Item name="chapter" label="Chương" rules={[{ required: true, message: 'Chọn chương đã index.' }]}>
            <Select
              showSearch
              optionFilterProp="label"
              disabled={editor?.mode === 'edit'}
              placeholder="Chọn chương có dữ liệu"
              options={chapterOptions}
              onChange={(chapter) => {
                if (editor?.mode === 'create') form.setFieldValue('title', taskTitleForChapter(chapter));
              }}
            />
          </Form.Item>
          <Form.Item name="title" label="Tiêu đề task" rules={[{ required: true, whitespace: true, message: 'Nhập tiêu đề task.' }]}>
            <Input maxLength={500} showCount />
          </Form.Item>
          <div className="expert-task-manager__form-grid">
            <Form.Item name="priority" label="Độ ưu tiên" rules={[{ required: true }]}>
              <InputNumber min={1} max={100} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item name="dueAt" label="Hạn xử lý">
              <Input type="datetime-local" />
            </Form.Item>
          </div>
          {editor?.mode === 'edit' && (
            <div className="expert-task-manager__form-grid">
              <Form.Item name="status" label="Trạng thái" rules={[{ required: true }]}>
                <Select options={TASK_STATUSES.map((value) => ({ value, label: value }))} />
              </Form.Item>
              <Form.Item name="assigneeId" label="ID Teacher">
                <Input allowClear placeholder="Để trống khi task OPEN" />
              </Form.Item>
            </div>
          )}
          <Form.Item name="instructions" label="Hướng dẫn Teacher">
            <Input.TextArea rows={5} maxLength={5000} showCount />
          </Form.Item>
        </Form>
      </Modal>

      <Drawer
        title="Chi tiết task"
        open={Boolean(detail)}
        onClose={() => setDetail(null)}
        width={560}
        className="expert-task-manager__drawer"
        extra={detail && <ActionButton icon={<Pencil size={15} />} onClick={() => openEdit(detail)}>Chỉnh sửa</ActionButton>}
      >
        {detailLoading ? (
          <AsyncState loading loadingLabel="Đang tải task..." />
        ) : detail && (
          <Descriptions bordered column={1} size="small">
            <Descriptions.Item label="Tiêu đề">{detail.title}</Descriptions.Item>
            <Descriptions.Item label="Chương">{detail.chapter}</Descriptions.Item>
            <Descriptions.Item label="Trạng thái"><StatusLabel status={detail.status} /></Descriptions.Item>
            <Descriptions.Item label="Người nhận">{detail.assigneeId || 'Chưa có'}</Descriptions.Item>
            <Descriptions.Item label="Ưu tiên">{detail.priority}</Descriptions.Item>
            <Descriptions.Item label="Hạn xử lý">{formatExpertTaskDateTime(detail.dueAt, 'Không đặt hạn')}</Descriptions.Item>
            <Descriptions.Item label="Bài nộp">{detail.contributionId || 'Chưa có'}</Descriptions.Item>
            <Descriptions.Item label="Hướng dẫn"><span className="expert-task-manager__instructions">{detail.instructions || 'Không có'}</span></Descriptions.Item>
          </Descriptions>
        )}
      </Drawer>
    </section>
  );
}
