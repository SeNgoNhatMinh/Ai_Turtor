import { useState } from 'react';
import {
  Card,
  Form,
  Input,
  Modal,
  Space,
  Tag,
  Typography,
} from 'antd';
import { CheckCircle2, Edit3, Eye, PowerOff, Trash2, X } from 'lucide-react';
import ActionButton from '../../../components/common/ActionButton';
import EntityActionMenu from '../../../components/common/EntityActionMenu';
import SearchableTable from '../../../components/common/SearchableTable';
import { confirmAction, confirmDanger } from '../../../components/common/confirmDialog';
import CachedAnswerPreview from './CachedAnswerPreview';

const { Paragraph, Text } = Typography;
const { TextArea } = Input;

const STATUS_META = {
  ACTIVE: { label: 'Đang dùng', color: 'success' },
  SENIOR_APPROVED: { label: 'Senior duyệt', color: 'blue' },
  SENIOR_CORRECTED: { label: 'Đã sửa', color: 'purple' },
  DISABLED: { label: 'Đã tắt', color: 'error' },
};

function formatDateTime(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString('vi-VN');
}

function ReviewStatusTag({ status }) {
  const meta = STATUS_META[status] || { label: status || '—', color: 'default' };
  return <Tag color={meta.color}>{meta.label}</Tag>;
}

export default function AnswerCacheTable({
  entries,
  loading,
  mutationKey,
  onApprove,
  onCorrect,
  onDisable,
  onDelete,
}) {
  const [detailEntry, setDetailEntry] = useState(null);
  const [correctEntry, setCorrectEntry] = useState(null);
  const [form] = Form.useForm();
  const anyMutationRunning = Boolean(mutationKey);

  const openCorrectModal = (entry) => {
    setCorrectEntry(entry);
    form.setFieldsValue({
      correctedAnswer: entry.answer || '',
      notes: entry.seniorReviewNotes || '',
    });
  };

  const closeCorrectModal = () => {
    setCorrectEntry(null);
    form.resetFields();
  };

  const saveCorrection = async (values) => {
    if (!correctEntry?.id) return;
    const saved = await onCorrect?.(
      correctEntry.id,
      String(values.correctedAnswer || '').trim(),
      String(values.notes || '').trim(),
    );
    if (saved) closeCorrectModal();
  };

  const handleAction = async (key, entry) => {
    if (!entry?.id || anyMutationRunning) return;
    if (key === 'view') {
      setDetailEntry(entry);
      return;
    }
    if (key === 'approve') {
      confirmAction({
        title: 'Duyệt cache câu trả lời?',
        content: 'Sinh viên sẽ tiếp tục nhận câu trả lời này từ cache semantic.',
        okText: 'Duyệt',
        onOk: () => onApprove?.(entry.id),
      });
      return;
    }
    if (key === 'correct') {
      openCorrectModal(entry);
      return;
    }
    if (key === 'disable') {
      confirmDanger({
        title: 'Tắt cache câu trả lời?',
        content: 'Sinh viên sẽ không còn nhận câu trả lời này từ cache semantic. Hệ thống vẫn gọi LLM khi có câu hỏi tương tự.',
        okText: 'Tắt cache',
        onOk: () => onDisable?.(entry.id, ''),
      });
      return;
    }
    if (key === 'delete') {
      confirmDanger({
        title: 'Xóa entry cache?',
        content: 'Entry sẽ bị xóa vĩnh viễn khỏi cache. Sinh viên sẽ phải gọi LLM lại cho câu hỏi tương tự.',
        okText: 'Xóa',
        onOk: () => onDelete?.(entry.id),
      });
    }
  };

  const buildMenuItems = (entry) => {
    const disabled = entry.reviewStatus === 'DISABLED';
    const items = [
      { key: 'view', label: 'Xem chi tiết', icon: <Eye size={15} /> },
    ];
    if (entry.reviewStatus !== 'SENIOR_APPROVED') {
      items.push({ key: 'approve', label: 'Duyệt', icon: <CheckCircle2 size={15} /> });
    }
    if (!disabled) {
      items.push({ key: 'correct', label: 'Sửa câu trả lời', icon: <Edit3 size={15} /> });
      items.push({ key: 'disable', label: 'Tắt cache', icon: <PowerOff size={15} />, danger: true });
    }
    items.push({ type: 'divider' });
    items.push({ key: 'delete', label: 'Xóa entry', icon: <Trash2 size={15} />, danger: true });
    return items;
  };

  const handleDetailAction = (key) => {
    const entry = detailEntry;
    setDetailEntry(null);
    handleAction(key, entry);
  };

  const columns = [
    {
      title: 'Câu hỏi',
      dataIndex: 'question',
      key: 'question',
      width: 280,
      ellipsis: true,
      render: (value) => <Text ellipsis={{ tooltip: value }}>{value || '—'}</Text>,
    },
    {
      title: 'Mode',
      dataIndex: 'mode',
      key: 'mode',
      width: 90,
      render: (value) => <Tag>{value || 'RAG'}</Tag>,
    },
    {
      title: 'Trạng thái',
      dataIndex: 'reviewStatus',
      key: 'reviewStatus',
      width: 130,
      render: (value) => <ReviewStatusTag status={value} />,
    },
    {
      title: 'Độ tin cậy',
      dataIndex: 'confidence',
      key: 'confidence',
      width: 110,
      render: (value) => (Number.isFinite(value) ? `${Math.round(value * 100)}%` : '—'),
    },
    {
      title: 'Semantic',
      dataIndex: 'semanticReady',
      key: 'semanticReady',
      width: 100,
      render: (value) => (
        <Tag color={value ? 'success' : 'default'}>{value ? 'Sẵn sàng' : 'Chưa có'}</Tag>
      ),
    },
    {
      title: 'Đã tái sử dụng',
      dataIndex: 'reuseCount',
      key: 'reuseCount',
      width: 120,
      render: (value) => Number(value) || 0,
    },
    {
      title: 'Dùng gần nhất',
      dataIndex: 'lastReusedAt',
      key: 'lastReusedAt',
      width: 170,
      render: formatDateTime,
    },
    {
      title: 'Tạo lúc',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 170,
      render: formatDateTime,
    },
    {
      title: '',
      key: 'actions',
      width: 64,
      fixed: 'right',
      render: (_, entry) => (
        <EntityActionMenu
          ariaLabel="Thao tác cache"
          disabled={anyMutationRunning}
          items={buildMenuItems(entry)}
          onAction={(key) => handleAction(key, entry)}
        />
      ),
    },
  ];

  return (
    <>
      <Card
        className="answer-cache-table-card"
        title="Cache câu trả lời AI"
        extra={<Text type="secondary">{entries.length} entry</Text>}
      >
        <SearchableTable
          rowKey="id"
          size="middle"
          scroll={{ x: 1250 }}
          loading={loading || anyMutationRunning}
          dataSource={entries}
          columns={columns}
          pagination={{ pageSize: 10, showSizeChanger: true, pageSizeOptions: ['10', '20', '50'] }}
        />
      </Card>

      <Modal
        open={Boolean(detailEntry)}
        title="Chi tiết cache"
        width={920}
        onCancel={() => setDetailEntry(null)}
        footer={detailEntry && (
          <div className="answer-cache-detail-actions">
            <ActionButton icon={<X size={15} />} onClick={() => setDetailEntry(null)}>
              Đóng
            </ActionButton>
            <Space wrap>
              {detailEntry.reviewStatus !== 'SENIOR_APPROVED' && (
                <ActionButton
                  intent="primary"
                  icon={<CheckCircle2 size={15} />}
                  loading={mutationKey === `approve-${detailEntry.id}`}
                  onClick={() => handleDetailAction('approve')}
                >
                  Duyệt
                </ActionButton>
              )}
              {detailEntry.reviewStatus !== 'DISABLED' && (
                <>
                  <ActionButton icon={<Edit3 size={15} />} onClick={() => handleDetailAction('correct')}>
                    Sửa câu trả lời
                  </ActionButton>
                  <ActionButton intent="danger" icon={<PowerOff size={15} />} onClick={() => handleDetailAction('disable')}>
                    Tắt cache
                  </ActionButton>
                </>
              )}
              <ActionButton intent="danger" icon={<Trash2 size={15} />} onClick={() => handleDetailAction('delete')}>
                Xóa entry
              </ActionButton>
            </Space>
          </div>
        )}
      >
        {detailEntry && (
          <Space direction="vertical" size="middle" className="answer-cache-detail">
            <div>
              <Text type="secondary">Trạng thái</Text>
              <div><ReviewStatusTag status={detailEntry.reviewStatus} /></div>
            </div>
            <div>
              <Text type="secondary">Câu hỏi</Text>
              <Paragraph>{detailEntry.question}</Paragraph>
            </div>
            <CachedAnswerPreview answer={detailEntry.answer} />
            {detailEntry.originalAnswer && (
              <CachedAnswerPreview answer={detailEntry.originalAnswer} original />
            )}
            <Space wrap>
              <Tag>Mode: {detailEntry.mode}</Tag>
              <Tag>Grounding: {detailEntry.groundingType || '—'}</Tag>
              {detailEntry.classId && <Tag>Class: {detailEntry.classId}</Tag>}
              {detailEntry.linkedReviewId && <Tag>Review: {detailEntry.linkedReviewId}</Tag>}
              <Tag>Tái sử dụng: {detailEntry.reuseCount || 0} lần</Tag>
            </Space>
            {detailEntry.lastReusedAt && (
              <Text type="secondary">Lần dùng cache gần nhất: {formatDateTime(detailEntry.lastReusedAt)}</Text>
            )}
            {(detailEntry.sources?.length > 0) && (
              <div>
                <Text type="secondary">Nguồn tham chiếu</Text>
                <ul className="answer-cache-sources">
                  {detailEntry.sources.map((source) => (
                    <li key={source}>{source}</li>
                  ))}
                </ul>
              </div>
            )}
            {detailEntry.seniorReviewerName && (
              <Text type="secondary">
                Senior: {detailEntry.seniorReviewerName}
                {detailEntry.seniorReviewedAt && ` · ${formatDateTime(detailEntry.seniorReviewedAt)}`}
              </Text>
            )}
            {detailEntry.seniorReviewNotes && (
              <Paragraph type="secondary">Ghi chú: {detailEntry.seniorReviewNotes}</Paragraph>
            )}
          </Space>
        )}
      </Modal>

      <Modal
        open={Boolean(correctEntry)}
        title="Sửa câu trả lời trong cache"
        onCancel={closeCorrectModal}
        footer={(
          <Space>
            <ActionButton onClick={closeCorrectModal}>Hủy</ActionButton>
            <ActionButton
              intent="primary"
              loading={mutationKey === `correct-${correctEntry?.id}`}
              onClick={() => form.submit()}
            >
              Lưu
            </ActionButton>
          </Space>
        )}
      >
        <Form form={form} layout="vertical" onFinish={saveCorrection}>
          <Form.Item
            name="correctedAnswer"
            label="Câu trả lời đã chỉnh"
            rules={[{ required: true, message: 'Nhập câu trả lời đã chỉnh' }]}
          >
            <TextArea rows={8} />
          </Form.Item>
          <Form.Item name="notes" label="Ghi chú Senior">
            <TextArea rows={3} placeholder="Lý do chỉnh sửa (tùy chọn)" />
          </Form.Item>
        </Form>
      </Modal>

    </>
  );
}
