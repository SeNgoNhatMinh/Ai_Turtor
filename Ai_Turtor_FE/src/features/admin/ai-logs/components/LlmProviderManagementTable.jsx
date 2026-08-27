import { useState } from 'react';
import {
  Alert,
  Button,
  Card,
  Form,
  Input,
  Modal,
  Space,
  Switch,
  Tag,
  Tooltip,
  Typography,
} from 'antd';
import SearchableTable from '../../../../components/common/SearchableTable';
import { Edit3, Power, PowerOff, RefreshCw, RotateCcw, Trash2 } from 'lucide-react';
import EntityActionMenu from '../../../../components/common/EntityActionMenu';
import { confirmAction, confirmDanger } from '../../../../components/common/confirmDialog';

const { Paragraph, Text } = Typography;

function ProviderState({ provider }) {
  if (provider.adminDeleted) return <Tag>Đã xóa khỏi chain</Tag>;
  if (provider.effectiveEnabled) return <Tag color="success">Đang hoạt động</Tag>;
  if (!provider.envEnabled) return <Tag color="warning">Môi trường đang tắt</Tag>;
  if (!provider.apiKeyConfigured) return <Tag color="error">Thiếu API key</Tag>;
  if (!provider.effectiveModel) return <Tag color="warning">Thiếu model</Tag>;
  return <Tag>Đã tắt</Tag>;
}

function getEnableBlockReason(provider) {
  if (!provider.envEnabled) return 'Provider đang bị tắt bởi biến môi trường Backend.';
  if (!provider.apiKeyConfigured) return 'Backend chưa có API key cho provider này.';
  if (!provider.effectiveModel) return 'Provider chưa có model hợp lệ.';
  return '';
}

export default function LlmProviderManagementTable({
  providers,
  loading,
  mutationKey,
  onUpdate,
  onSetEnabled,
  onDelete,
  onRestore,
  onReload,
}) {
  const [form] = Form.useForm();
  const [editingProvider, setEditingProvider] = useState(null);
  const anyMutationRunning = Boolean(mutationKey);

  const openEditor = (provider) => {
    setEditingProvider(provider);
    form.setFieldsValue({
      enabled: provider.adminEnabledOverride ?? provider.effectiveEnabled,
      model: provider.adminModelOverride ?? provider.effectiveModel,
    });
  };

  const closeEditor = () => {
    setEditingProvider(null);
    form.resetFields();
  };

  const saveProvider = async (values) => {
    if (!editingProvider?.providerId) return;
    const saved = await onUpdate?.(editingProvider.providerId, {
      enabled: Boolean(values.enabled),
      model: String(values.model || '').trim(),
    });
    if (saved) closeEditor();
  };

  const columns = [
    {
      title: 'Provider',
      key: 'provider',
      width: 210,
      fixed: 'left',
      render: (_, provider) => (
        <Space direction="vertical" size={2}>
          <Text strong>{provider.label}</Text>
          <Text type="secondary" className="admin-provider-id">{provider.providerId}</Text>
          {provider.family && <Tag className="admin-provider-family-tag">{provider.family}</Tag>}
        </Space>
      ),
    },
    {
      title: 'Model đang dùng',
      key: 'model',
      width: 290,
      render: (_, provider) => (
        <Space direction="vertical" size={3} className="admin-provider-model-cell">
          <Text copyable={Boolean(provider.effectiveModel)} ellipsis={{ tooltip: provider.effectiveModel }}>
            {provider.effectiveModel || 'Chưa cấu hình'}
          </Text>
          {provider.adminModelOverride
            ? <Tag color="blue">Admin override</Tag>
            : <Tag>Từ biến môi trường</Tag>}
        </Space>
      ),
    },
    {
      title: 'Kết nối',
      key: 'connection',
      width: 190,
      render: (_, provider) => (
        <Space direction="vertical" size={3}>
          <Tag color={provider.apiKeyConfigured ? 'success' : 'error'}>
            {provider.apiKeyConfigured ? 'Đã cấu hình xác thực' : 'Thiếu API key'}
          </Tag>
          <Tooltip title={provider.baseUrl || 'Không có base URL'}>
            <Text type="secondary" ellipsis className="admin-provider-base-url">
              {provider.baseUrl || '—'}
            </Text>
          </Tooltip>
          <Text type="secondary">Timeout: {provider.timeoutSeconds || '—'}s</Text>
        </Space>
      ),
    },
    {
      title: 'Trạng thái hiệu lực',
      key: 'status',
      width: 180,
      render: (_, provider) => (
        <Space direction="vertical" size={4}>
          <ProviderState provider={provider} />
          {provider.adminEnabledOverride !== null && (
            <Text type="secondary">
              Admin: {provider.adminEnabledOverride ? 'bật' : 'tắt'}
            </Text>
          )}
        </Space>
      ),
    },
    {
      title: 'Cập nhật',
      key: 'updated',
      width: 180,
      render: (_, provider) => provider.updatedAt ? (
        <Space direction="vertical" size={2}>
          <Text>{new Date(provider.updatedAt).toLocaleString('vi-VN')}</Text>
          <Text type="secondary" ellipsis={{ tooltip: provider.updatedBy }}>
            {provider.updatedBy || 'Admin'}
          </Text>
        </Space>
      ) : <Text type="secondary">Chưa có override</Text>,
    },
    {
      title: '',
      key: 'actions',
      width: 56,
      fixed: 'right',
      render: (_, provider) => {
        const enableBlockReason = getEnableBlockReason(provider);
        const items = provider.adminDeleted
          ? [{ key: 'restore', icon: <RotateCcw size={14} />, label: 'Khôi phục provider' }]
          : [
              { key: 'edit', icon: <Edit3 size={14} />, label: 'Chỉnh cấu hình' },
              provider.effectiveEnabled
                ? { key: 'disable', icon: <PowerOff size={14} />, label: 'Tắt provider' }
                : {
                    key: 'enable',
                    icon: <Power size={14} />,
                    label: enableBlockReason
                      ? <Tooltip title={enableBlockReason}>Bật provider</Tooltip>
                      : 'Bật provider',
                    disabled: Boolean(enableBlockReason),
                  },
              { type: 'divider' },
              { key: 'delete', icon: <Trash2 size={14} />, label: 'Xóa khỏi chain', danger: true },
            ];

        return (
          <EntityActionMenu
            items={items}
            disabled={anyMutationRunning}
            ariaLabel={`Thao tác với ${provider.label}`}
            onAction={(key, meta) => {
              if (key === 'edit') openEditor(provider);
              if (key === 'enable') onSetEnabled?.(provider.providerId, true);
              if (key === 'disable') {
                confirmAction({
                  title: `Tắt ${provider.label}?`,
                  content: 'Provider sẽ bị loại khỏi chain ngay sau khi Backend reload cấu hình.',
                  okText: 'Tắt provider',
                  cancelText: 'Hủy',
                  anchorRect: meta?.anchorRect,
                  onOk: () => onSetEnabled?.(provider.providerId, false),
                });
              }
              if (key === 'delete') {
                confirmDanger({
                  title: `Xóa ${provider.label} khỏi chain?`,
                  content: 'Dữ liệu cấu hình gốc không bị xóa. Admin có thể khôi phục provider sau.',
                  okText: 'Xóa khỏi chain',
                  cancelText: 'Hủy',
                  anchorRect: meta?.anchorRect,
                  onOk: () => onDelete?.(provider.providerId),
                });
              }
              if (key === 'restore') {
                confirmAction({
                  title: `Khôi phục ${provider.label}?`,
                  content: 'Backend sẽ khôi phục provider và reload runtime chain.',
                  okText: 'Khôi phục',
                  cancelText: 'Hủy',
                  anchorRect: meta?.anchorRect,
                  onOk: () => onRestore?.(provider.providerId),
                });
              }
            }}
          />
        );
      },
    },
  ];

  const confirmReload = (event) => {
    confirmAction({
      title: 'Reload LLM provider chain?',
      content: 'Backend sẽ nạp lại chain từ cấu hình hiện tại. Request AI mới sẽ dùng chain sau khi reload.',
      okText: 'Reload chain',
      cancelText: 'Hủy',
      anchorRect: event.currentTarget.getBoundingClientRect(),
      onOk: onReload,
    });
  };

  return (
    <>
      <Card
        className="admin-ai-logs-section-card admin-provider-management-card"
        title="Quản lý LLM provider chain"
        extra={(
          <Button
            icon={<RefreshCw size={15} />}
            loading={mutationKey === 'reload'}
            disabled={anyMutationRunning && mutationKey !== 'reload'}
            onClick={confirmReload}
          >
            Reload chain
          </Button>
        )}
      >
        <Alert
          className="admin-provider-guidance"
          type="info"
          showIcon
          title="Backend là nguồn trạng thái chuẩn"
          description="Bật/tắt, đổi model, xóa hoặc khôi phục đều reload runtime chain. API key và provider bị tắt từ biến môi trường phải được sửa tại môi trường deploy."
        />
        <SearchableTable
          size="middle"
          rowKey="providerId"
          dataSource={providers}
          loading={loading}
          pagination={false}
          scroll={{ x: 1180 }}
          columns={columns}
          rowClassName={(provider) => provider.adminDeleted ? 'admin-provider-row--deleted' : ''}
        />
      </Card>

      <Modal
        title={`Chỉnh cấu hình ${editingProvider?.label || 'provider'}`}
        open={Boolean(editingProvider)}
        onCancel={closeEditor}
        footer={null}
        destroyOnHidden
      >
        <Form form={form} layout="vertical" onFinish={saveProvider}>
          <Form.Item label="Provider ID">
            <Input value={editingProvider?.providerId} disabled />
          </Form.Item>
          <Form.Item
            name="model"
            label="Model override"
            extra={`Để trống để quay về model từ env${editingProvider?.envModel ? `: ${editingProvider.envModel}` : '.'}`}
            rules={[{
              validator: (_, value) => {
                const enabled = form.getFieldValue('enabled');
                if (!enabled || String(value || '').trim() || editingProvider?.envModel) return Promise.resolve();
                return Promise.reject(new Error('Provider đang bật phải có model.'));
              },
            }]}
          >
            <Input placeholder="Ví dụ: openai/gpt-oss-120b" allowClear />
          </Form.Item>
          <Form.Item
            name="enabled"
            label="Admin override"
            valuePropName="checked"
            extra={!editingProvider?.envEnabled
              ? 'Provider đang bị tắt từ biến môi trường Backend.'
              : 'Thay đổi áp dụng ngay sau khi Backend reload chain.'}
          >
            <Switch
              disabled={!editingProvider?.envEnabled}
              checkedChildren="Bật"
              unCheckedChildren="Tắt"
            />
          </Form.Item>
          {editingProvider?.adminModelOverride && (
            <Paragraph type="secondary" className="admin-provider-reset-hint">
              Xóa nội dung Model override rồi lưu để dùng lại model từ biến môi trường.
            </Paragraph>
          )}
          <Space className="admin-provider-modal-actions">
            <Button onClick={closeEditor} disabled={anyMutationRunning}>Hủy</Button>
            <Button
              type="primary"
              htmlType="submit"
              loading={mutationKey === `update:${editingProvider?.providerId}`}
              disabled={anyMutationRunning && mutationKey !== `update:${editingProvider?.providerId}`}
            >
              Lưu và reload
            </Button>
          </Space>
        </Form>
      </Modal>
    </>
  );
}
