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
import { Pencil, RefreshCw, Trash2 } from 'lucide-react';
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
      });
      setItems(data);
    } catch (reason) {
      setError(getUserFacingError(reason, 'Không thể tải các chỉ mục câu trả lời đã duyệt.'));
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [courseId]);

  useEffect(() => {
    const timer = window.setTimeout(loadCourses, 0);
    return () => window.clearTimeout(timer);
  }, [loadCourses]);

  useEffect(() => {
    const timer = window.setTimeout(loadNotes, 0);
    return () => window.clearTimeout(timer);
  }, [loadNotes]);

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

  const openEdit = (row) => {
    setEditing(row);
    form.setFieldsValue({
      chapter: row.chapter || '',
      question: row.question || '',
      approvedAnswer: row.approvedAnswer || '',
    });
  };

  const saveEdit = async () => {
    const values = await form.validateFields();
    setPendingId(editing.id);
    try {
      await indexedTeachingNotesApi.update(editing.id, { ...values, reindex: true });
      triggerToast?.('Đã cập nhật chỉ mục câu trả lời.');
      setEditing(null);
      await loadNotes();
    } catch (reason) {
      triggerToast?.(getUserFacingError(reason, 'Không thể cập nhật chỉ mục.'));
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

  return (
    <div className="portal-section admin-route-page admin-indexed-notes-page">
      <PageHeader
        eyebrow="Giám sát AI"
        title="Chỉ mục câu trả lời đã duyệt"
        description="Hiển thị các câu trả lời V2 đã được Senior duyệt và đang thực sự được RAG sử dụng."
        actions={(
          <Button icon={<RefreshCw size={16} />} onClick={loadNotes} disabled={Boolean(pendingId)}>
            Làm mới
          </Button>
        )}
      />

      {error && <Alert type="error" showIcon title={error} />}

      <Card className="admin-indexed-notes-filters">
        <div className="admin-indexed-notes-filter-grid">
          <div className="admin-indexed-notes-filter-field">
            <Text type="secondary">Môn học</Text>
            <Select
              value={courseId || ''}
              options={courseOptions}
              onChange={(value) => setCourseId?.(value || '')}
              showSearch
              optionFilterProp="label"
            />
          </div>
        </div>
        <Paragraph type="secondary" style={{ margin: '12px 0 0' }}>
          {items.length} chỉ mục đang hoạt động trong RAG
        </Paragraph>
      </Card>

      <Card className="admin-indexed-notes-list-card" title="Danh sách chỉ mục Senior đã duyệt">
        <SearchableTable
          rowKey={(row) => row.id}
          loading={loading}
          dataSource={items}
          sticky={false}
          scroll={{ x: 1370, y: 520 }}
          searchKeys={['courseId', 'chapter', 'question', 'approvedAnswer', 'authorId', 'reviewedBy']}
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
              width: 280,
              ellipsis: true,
            },
            {
              title: 'Câu trả lời đã duyệt',
              dataIndex: 'approvedAnswer',
              width: 380,
              render: (value) => (
                <Paragraph ellipsis={{ rows: 2, tooltip: value }} style={{ margin: 0 }}>
                  {value}
                </Paragraph>
              ),
            },
            {
              title: 'Trạng thái',
              dataIndex: 'status',
              width: 140,
              render: (status) => <Tag color="success">{getStatusLabel(status)}</Tag>,
            },
            {
              title: 'Thao tác',
              key: 'actions',
              width: 240,
              render: (_, row) => (
                <Space wrap size={6} className="admin-indexed-notes-actions">
                  <Button
                    size="small"
                    icon={<Pencil size={14} />}
                    disabled={Boolean(pendingId)}
                    onClick={() => openEdit(row)}
                  >
                    Sửa
                  </Button>
                  <Button
                    size="small"
                    danger
                    icon={<Trash2 size={14} />}
                    disabled={Boolean(pendingId)}
                    onClick={() => confirmDanger({
                      title: 'Gỡ chỉ mục này khỏi RAG?',
                      content: 'Chỉ xóa dữ liệu khỏi Elasticsearch. Bản ghi duyệt V2 vẫn được giữ để không làm đứt task và lịch sử kiểm duyệt.',
                      okText: 'Gỡ khỏi RAG',
                      cancelText: 'Hủy',
                      onOk: () => runAction(row.id, () => indexedTeachingNotesApi.remove(row.id), 'Đã gỡ chỉ mục khỏi RAG.'),
                    })}
                  >
                    Gỡ chỉ mục
                  </Button>
                </Space>
              ),
            },
          ]}
        />
      </Card>

      <Modal
        title="Sửa chỉ mục câu trả lời"
        open={Boolean(editing)}
        onCancel={() => setEditing(null)}
        onOk={saveEdit}
        okText="Lưu & cập nhật RAG"
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
              title={`${editing.courseId} · Đang được RAG sử dụng`}
              description="Lưu sẽ cập nhật nội dung đã duyệt và viết lại chỉ mục Elasticsearch."
            />
            <Form.Item name="chapter" label="Chương" rules={[{ required: true, whitespace: true }]}>
              <Input maxLength={255} />
            </Form.Item>
            <Form.Item name="question" label="Câu hỏi" rules={[{ required: true, whitespace: true }]}>
              <TextArea rows={3} maxLength={5000} showCount />
            </Form.Item>
            <Form.Item name="approvedAnswer" label="Câu trả lời đã duyệt" rules={[{ required: true, whitespace: true }]}>
              <TextArea rows={8} maxLength={5000} showCount />
            </Form.Item>
          </Form>
        )}
      </Modal>
    </div>
  );
}
