import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Alert,
  Card,
  Form,
  Input,
  Modal,
  Select,
  Tag,
  Typography,
} from 'antd';
import { Pencil, RefreshCw, Trash2, Undo2 } from 'lucide-react';
import ActionButton from '../../../components/common/ActionButton';
import EntityActionMenu from '../../../components/common/EntityActionMenu';
import PageHeader from '../../../components/common/PageHeader';
import SearchableTable from '../../../components/common/SearchableTable';
import { confirmDanger } from '../../../components/common/confirmDialog';
import { adminAcademicApi } from '../../../services/adminAcademicApi';
import { indexedTeachingNotesApi } from '../../../services/indexedTeachingNotesApi';
import { getUserFacingError } from '../../../services/apiClient';
import { getStatusLabel } from '../../../utils/statusLabels';
import { queryKeys } from '../../../app/queryKeys';
import './AdminIndexedTeachingNotesPage.css';

const { Paragraph, Text } = Typography;
const { TextArea } = Input;
const EMPTY_LIST = [];

const courseCode = (course = {}) => String(course.courseId || course.id || course.code || '').trim();
const courseName = (course = {}) => course.courseName || course.name || course.title || courseCode(course);

const getKnowledgeTypeLabel = (value) => {
  const normalized = String(value || '').trim().toUpperCase();
  if (normalized === 'ACADEMIC_KNOWLEDGE') return 'Kiến thức học thuật';
  if (normalized === 'GOLD_QA') return 'Q&A đã duyệt';
  return value || '—';
};

export default function AdminIndexedTeachingNotesPage({ courseId, setCourseId, triggerToast }) {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState('');
  const [pendingId, setPendingId] = useState('');
  const [editing, setEditing] = useState(null);
  const [form] = Form.useForm();

  const coursesQuery = useQuery({
    queryKey: queryKeys.adminCourses(),
    queryFn: ({ signal }) => adminAcademicApi.getCourses({ signal }),
    staleTime: 60_000,
  });
  const notesQuery = useQuery({
    queryKey: queryKeys.adminIndexedTeachingNotes(courseId, statusFilter),
    queryFn: ({ signal }) => indexedTeachingNotesApi.list({
        courseId: courseId || undefined,
        status: statusFilter || undefined,
      }, { signal }),
    staleTime: 15_000,
  });
  const courses = useMemo(
    () => (coursesQuery.data || EMPTY_LIST).filter((item) => courseCode(item)),
    [coursesQuery.data],
  );
  const items = notesQuery.data || EMPTY_LIST;
  const loading = notesQuery.isPending || notesQuery.isFetching;
  const queryError = notesQuery.error || coursesQuery.error;
  const error = queryError
    ? getUserFacingError(queryError, 'Không thể tải dữ liệu index Senior đã duyệt.')
    : '';
  const loadNotes = () => notesQuery.refetch();

  const courseOptions = useMemo(
    () => [
      { value: '', label: 'Tất cả môn' },
      ...courses.map((course) => ({
        value: courseCode(course),
        label: `${courseCode(course)} · ${courseName(course)}`,
      })),
    ],
    [courses],
  );

  const stats = useMemo(() => ({
    total: items.length,
    indexed: items.filter((item) => item.status === 'INDEXED').length,
    unindexed: items.filter((item) => item.status === 'UNINDEXED').length,
  }), [items]);

  const openEdit = (row) => {
    setEditing(row);
    form.setFieldsValue({
      question: row.question || '',
      goldAnswer: row.goldAnswer || row.answer || '',
    });
  };

  const saveEdit = async () => {
    const values = await form.validateFields();
    setPendingId(editing.id);
    try {
      await indexedTeachingNotesApi.update(editing.id, { ...values, reindex: true });
      triggerToast?.('Đã cập nhật và nạp lại chỉ mục knowledge.');
      setEditing(null);
      await queryClient.invalidateQueries({ queryKey: ['admin', 'indexed-teaching-notes'] });
    } catch (reason) {
      triggerToast?.(getUserFacingError(reason, 'Không thể cập nhật index.'));
    } finally {
      setPendingId('');
    }
  };

  const runAction = async (id, action, successMessage) => {
    setPendingId(id);
    try {
      await action();
      triggerToast?.(successMessage);
      await queryClient.invalidateQueries({ queryKey: ['admin', 'indexed-teaching-notes'] });
    } catch (reason) {
      triggerToast?.(getUserFacingError(reason, 'Thao tác thất bại.'));
    } finally {
      setPendingId('');
    }
  };

  const statusTag = (status) => {
    if (status === 'INDEXED') return <Tag color="success">{getStatusLabel(status)}</Tag>;
    if (status === 'UNINDEXED') return <Tag color="default">{getStatusLabel(status)}</Tag>;
    return <Tag>{getStatusLabel(status)}</Tag>;
  };

  const handleRowAction = (key, row) => {
    if (key === 'edit') {
      openEdit(row);
      return;
    }
    if (key === 'reindex') {
      void runAction(row.id, () => indexedTeachingNotesApi.reindex(row.id), 'Đã nạp lại vào RAG.');
      return;
    }
    if (key === 'unindex') {
      void runAction(row.id, () => indexedTeachingNotesApi.unindex(row.id), 'Đã gỡ khỏi RAG.');
      return;
    }
    if (key === 'delete') {
      confirmDanger({
        title: 'Xóa index này?',
        content: 'Chỉ xóa knowledge Senior đã duyệt (không đụng giáo trình). Không thể hoàn tác.',
        okText: 'Xóa',
        onOk: () => runAction(row.id, () => indexedTeachingNotesApi.remove(row.id), 'Đã xóa index.'),
      });
    }
  };

  const rowActions = (row) => [
    { key: 'edit', label: 'Sửa', icon: <Pencil size={14} /> },
    row.status === 'UNINDEXED'
      ? { key: 'reindex', label: 'Nạp lại RAG', icon: <RefreshCw size={14} /> }
      : { key: 'unindex', label: 'Gỡ khỏi RAG', icon: <Undo2 size={14} /> },
    { type: 'divider' },
    { key: 'delete', label: 'Xóa index', icon: <Trash2 size={14} />, danger: true },
  ];

  return (
    <div className="portal-section admin-route-page admin-indexed-notes-page">
      <PageHeader
        eyebrow="Giám sát AI"
        title="Index Senior đã duyệt (RAG)"
        description="Danh sách toàn bộ knowledge V2 và Gold Q&A Senior đã nạp vào Elasticsearch. Có thể sửa, gỡ RAG hoặc xóa."
        actions={(
          <ActionButton icon={<RefreshCw size={16} />} onClick={loadNotes} disabled={Boolean(pendingId)}>
            Làm mới
          </ActionButton>
        )}
      />

      {error && <Alert type="error" showIcon title={error} />}

      <Card className="admin-indexed-notes-filters">
        <div className="admin-indexed-notes-filter-grid">
          <div>
            <Text type="secondary">Môn học</Text>
            <Select
              className="admin-indexed-notes-filter-select"
              value={courseId || ''}
              options={courseOptions}
              onChange={(value) => setCourseId?.(value || '')}
              showSearch
              optionFilterProp="label"
            />
          </div>
          <div>
            <Text type="secondary">Trạng thái</Text>
            <Select
              className="admin-indexed-notes-filter-select"
              value={statusFilter}
              options={[
                { value: '', label: 'Đã nạp + đã gỡ' },
                { value: 'INDEXED', label: 'Đang trong RAG' },
                { value: 'UNINDEXED', label: 'Đã gỡ khỏi RAG' },
              ]}
              onChange={setStatusFilter}
            />
          </div>
        </div>
        <Paragraph type="secondary" style={{ margin: '12px 0 0' }}>
          {stats.total} index · {stats.indexed} đang nạp · {stats.unindexed} đã gỡ
        </Paragraph>
      </Card>

      <Card title="Knowledge Senior đã duyệt vào RAG">
        <SearchableTable
          rowKey={(row) => row.id}
          loading={loading}
          dataSource={items}
          sticky={false}
          scroll={{ x: 900, y: 520 }}
          searchKeys={['courseId', 'chapter', 'question', 'goldAnswer', 'answer', 'authorId', 'candidateType']}
          columns={[
            {
              title: 'Môn',
              dataIndex: 'courseId',
              width: 110,
              render: (value) => <Text strong>{value}</Text>,
            },
            {
              title: 'Loại',
              dataIndex: 'chapter',
              width: 180,
              ellipsis: true,
              render: getKnowledgeTypeLabel,
            },
            {
              title: 'Câu hỏi',
              dataIndex: 'question',
              ellipsis: true,
            },
            {
              title: 'Trạng thái',
              dataIndex: 'status',
              width: 150,
              render: statusTag,
            },
            {
              title: <span className="sr-only">Thao tác</span>,
              key: 'actions',
              width: 56,
              fixed: 'right',
              render: (_, row) => (
                <EntityActionMenu
                  ariaLabel="Thao tác index Senior"
                  disabled={Boolean(pendingId)}
                  items={rowActions(row)}
                  onAction={(key) => handleRowAction(key, row)}
                />
              ),
            },
          ]}
        />
      </Card>

      <Modal
        title="Sửa knowledge Senior đã duyệt"
        open={Boolean(editing)}
        onCancel={() => setEditing(null)}
        onOk={saveEdit}
        okText="Lưu & nạp lại RAG"
        cancelText="Hủy"
        confirmLoading={Boolean(editing && pendingId === editing.id)}
        width={720}
        destroyOnClose
      >
        {editing && (
          <Form form={form} layout="vertical">
            <Alert
              type="info"
              showIcon
              style={{ marginBottom: 12 }}
              title={`${editing.courseId} · ${editing.status === 'INDEXED' ? 'Đang trong RAG' : 'Đã gỡ RAG'}`}
              description="Lưu sẽ cập nhật câu hỏi/đáp án và viết lại chunk Elasticsearch."
            />
            <Form.Item name="question" label="Câu hỏi" rules={[{ required: true, whitespace: true }]}>
              <TextArea rows={3} maxLength={5000} showCount />
            </Form.Item>
            <Form.Item name="goldAnswer" label="Câu trả lời đã duyệt" rules={[{ required: true, whitespace: true }]}>
              <TextArea rows={8} maxLength={5000} showCount />
            </Form.Item>
          </Form>
        )}
      </Modal>
    </div>
  );
}
