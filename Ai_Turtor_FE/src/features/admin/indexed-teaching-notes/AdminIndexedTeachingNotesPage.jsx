import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Button,
  Card,
  Form,
  Input,
  Modal,
  Select,
  Space,
  Tag,
  Typography,
} from 'antd';
import { Pencil, RefreshCw, Trash2, Undo2 } from 'lucide-react';
import PageHeader from '../../../components/common/PageHeader';
import SearchableTable from '../../../components/common/SearchableTable';
import { confirmDanger } from '../../../components/common/confirmDialog';
import { adminAcademicApi } from '../../../services/adminAcademicApi';
import { indexedTeachingNotesApi } from '../../../services/indexedTeachingNotesApi';
import { getUserFacingError } from '../../../services/apiClient';
import { getStatusLabel } from '../../../utils/statusLabels';
import './AdminIndexedTeachingNotesPage.css';

const { Paragraph, Text } = Typography;
const { TextArea } = Input;

const courseCode = (course = {}) => String(course.courseId || course.id || course.code || '').trim();
const courseName = (course = {}) => course.courseName || course.name || course.title || courseCode(course);

export default function AdminIndexedTeachingNotesPage({ courseId, setCourseId, triggerToast }) {
  const [courses, setCourses] = useState([]);
  const [items, setItems] = useState([]);
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [pendingId, setPendingId] = useState('');
  const [editing, setEditing] = useState(null);
  const [form] = Form.useForm();

  const loadCourses = useCallback(async () => {
    try {
      const data = await adminAcademicApi.getCourses();
      setCourses((data || []).filter((item) => courseCode(item)));
    } catch (reason) {
      setError(getUserFacingError(reason, 'Không thể tải danh sách môn học.'));
    }
  }, []);

  const loadNotes = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await indexedTeachingNotesApi.list({
        courseId: courseId || undefined,
        status: statusFilter || undefined,
      });
      setItems(data);
    } catch (reason) {
      setError(getUserFacingError(reason, 'Không thể tải ghi chú giảng dạy đã index.'));
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [courseId, statusFilter]);

  useEffect(() => { loadCourses(); }, [loadCourses]);
  useEffect(() => { loadNotes(); }, [loadNotes]);

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
      chapter: row.chapter || '',
      question: row.question || '',
      goldAnswer: row.goldAnswer || '',
    });
  };

  const saveEdit = async () => {
    const values = await form.validateFields();
    setPendingId(editing.id);
    try {
      await indexedTeachingNotesApi.update(editing.id, { ...values, reindex: true });
      triggerToast?.('Đã cập nhật và nạp lại chỉ mục ghi chú.');
      setEditing(null);
      await loadNotes();
    } catch (reason) {
      triggerToast?.(getUserFacingError(reason, 'Không thể cập nhật ghi chú.'));
    } finally {
      setPendingId('');
    }
  };

  const runAction = async (id, action, successMessage) => {
    setPendingId(id);
    try {
      await action();
      triggerToast?.(successMessage);
      await loadNotes();
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

  return (
    <div className="portal-section admin-route-page admin-indexed-notes-page">
      <PageHeader
        eyebrow="Giám sát AI"
        title="Ghi chú giảng dạy đã nạp RAG"
        description="Quản lý Gold Q&A Senior đã duyệt vào Elasticsearch: sửa nội dung lỗi thời, gỡ khỏi RAG hoặc xóa hẳn."
        actions={(
          <Button icon={<RefreshCw size={16} />} onClick={loadNotes} disabled={Boolean(pendingId)}>
            Làm mới
          </Button>
        )}
      />

      {error && <Alert type="error" showIcon title={error} />}

      <Card className="admin-indexed-notes-filters">
        <Space wrap size={12}>
          <div>
            <Text type="secondary">Môn học</Text>
            <Select
              style={{ minWidth: 260, display: 'block' }}
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
              style={{ minWidth: 180, display: 'block' }}
              value={statusFilter}
              options={[
                { value: '', label: 'Đã nạp + đã gỡ' },
                { value: 'INDEXED', label: 'Đang trong RAG' },
                { value: 'UNINDEXED', label: 'Đã gỡ khỏi RAG' },
              ]}
              onChange={setStatusFilter}
            />
          </div>
        </Space>
        <Paragraph type="secondary" style={{ margin: '12px 0 0' }}>
          {stats.total} ghi chú · {stats.indexed} đang nạp · {stats.unindexed} đã gỡ
        </Paragraph>
      </Card>

      <Card title="Danh sách ghi chú Gold Q&A">
        <SearchableTable
          rowKey={(row) => row.id}
          loading={loading}
          dataSource={items}
          sticky={false}
          scroll={{ x: 1100, y: 520 }}
          searchKeys={['courseId', 'chapter', 'question', 'goldAnswer', 'authorId']}
          columns={[
            {
              title: 'Môn',
              dataIndex: 'courseId',
              width: 110,
              render: (value) => <Text strong>{value}</Text>,
            },
            {
              title: 'Chương',
              dataIndex: 'chapter',
              width: 220,
              ellipsis: true,
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
              title: 'Thao tác',
              key: 'actions',
              width: 320,
              fixed: 'right',
              render: (_, row) => (
                <Space wrap size={6}>
                  <Button
                    size="small"
                    icon={<Pencil size={14} />}
                    disabled={Boolean(pendingId)}
                    onClick={() => openEdit(row)}
                  >
                    Sửa
                  </Button>
                  {row.status === 'UNINDEXED' ? (
                    <Button
                      size="small"
                      loading={pendingId === row.id}
                      disabled={Boolean(pendingId) && pendingId !== row.id}
                      icon={<RefreshCw size={14} />}
                      onClick={() => runAction(row.id, () => indexedTeachingNotesApi.reindex(row.id), 'Đã nạp lại vào RAG.')}
                    >
                      Nạp lại
                    </Button>
                  ) : (
                    <Button
                      size="small"
                      loading={pendingId === row.id}
                      disabled={Boolean(pendingId) && pendingId !== row.id}
                      icon={<Undo2 size={14} />}
                      onClick={() => runAction(row.id, () => indexedTeachingNotesApi.unindex(row.id), 'Đã gỡ khỏi RAG.')}
                    >
                      Gỡ RAG
                    </Button>
                  )}
                  <Button
                    size="small"
                    danger
                    icon={<Trash2 size={14} />}
                    disabled={Boolean(pendingId)}
                    onClick={() => confirmDanger({
                      title: 'Xóa ghi chú này?',
                      content: 'Xóa khỏi Mongo và Elasticsearch. Không thể hoàn tác.',
                      okText: 'Xóa',
                      cancelText: 'Hủy',
                      onOk: () => runAction(row.id, () => indexedTeachingNotesApi.remove(row.id), 'Đã xóa ghi chú.'),
                    })}
                  >
                    Xóa
                  </Button>
                </Space>
              ),
            },
          ]}
        />
      </Card>

      <Modal
        title="Sửa ghi chú giảng dạy"
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
              description="Lưu sẽ cập nhật nội dung và viết lại chunk Elasticsearch (nếu đang/được nạp)."
            />
            <Form.Item name="chapter" label="Chương" rules={[{ required: true, whitespace: true }]}>
              <Input maxLength={255} />
            </Form.Item>
            <Form.Item name="question" label="Câu hỏi" rules={[{ required: true, whitespace: true }]}>
              <TextArea rows={3} maxLength={5000} showCount />
            </Form.Item>
            <Form.Item name="goldAnswer" label="Tóm tắt ý chính" rules={[{ required: true, whitespace: true }]}>
              <TextArea rows={8} maxLength={5000} showCount />
            </Form.Item>
          </Form>
        )}
      </Modal>
    </div>
  );
}
