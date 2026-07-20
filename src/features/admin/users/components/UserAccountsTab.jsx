import { Edit, RefreshCw, Trash2 } from 'lucide-react';
import { Button, Card, Form, Input, Modal, Select, Space, Switch, Table, Tag } from 'antd';
import EntityActionMenu from '../../../../components/common/EntityActionMenu';
import StatusLabel from '../../../../components/common/StatusLabel';
import { confirmDanger } from '../../../../components/common/confirmDialog';
import { ACCOUNT_ROLES } from '../../../../constants/roles';

const roleOptions = [
  { value: ACCOUNT_ROLES.STUDENT, label: 'Sinh viên' },
  { value: ACCOUNT_ROLES.TEACHER, label: 'Giảng viên' },
  { value: ACCOUNT_ROLES.SENIOR_MENTOR, label: 'Senior Mentor' },
  { value: ACCOUNT_ROLES.ADMIN, label: 'Quản trị viên' },
];

function getRoleColor(role) {
  if (role === ACCOUNT_ROLES.ADMIN) return 'volcano';
  if (role === ACCOUNT_ROLES.SENIOR_MENTOR) return 'purple';
  if (role === ACCOUNT_ROLES.TEACHER) return 'geekblue';
  return 'green';
}

export default function UserAccountsTab({ users }) {
  const [form] = Form.useForm();

  const openEditor = (record) => {
    users.openEdit(record);
    form.setFieldsValue({ role: record.role, isActive: record.isActive !== false });
  };

  const columns = [
    { title: 'Email', dataIndex: 'email', key: 'email', ellipsis: true },
    { title: 'Họ tên', dataIndex: 'fullName', key: 'fullName', render: (value) => value || '—' },
    {
      title: 'Vai trò',
      dataIndex: 'role',
      key: 'role',
      width: 140,
      render: (role) => <Tag color={getRoleColor(role)}>{role || ACCOUNT_ROLES.STUDENT}</Tag>,
    },
    {
      title: 'Trạng thái',
      dataIndex: 'isActive',
      key: 'isActive',
      width: 120,
      render: (value) => <StatusLabel status={value !== false ? 'ACTIVE' : 'INACTIVE'} />,
    },
    {
      title: '',
      key: 'action',
      width: 56,
      render: (_, record) => (
        <EntityActionMenu
          items={[
            { key: 'edit', icon: <Edit size={14} />, label: 'Chỉnh sửa' },
            { type: 'divider' },
            { key: 'delete', icon: <Trash2 size={14} />, label: 'Xóa tài khoản', danger: true },
          ]}
          ariaLabel={`Thao tác với ${record.fullName || record.email}`}
          onAction={(key, meta) => {
            if (key === 'edit') openEditor(record);
            if (key === 'delete') {
              confirmDanger({
                title: 'Xóa tài khoản này?',
                content: 'Tài khoản sẽ bị xóa khỏi hệ thống và không thể hoàn tác.',
                anchorRect: meta?.anchorRect,
                onOk: () => users.remove(record.id),
              });
            }
          }}
        />
      ),
    },
  ];

  return (
    <>
      <Card hoverable>
        <Space style={{ marginBottom: 16, width: '100%', justifyContent: 'space-between' }}>
          <Space wrap>
            <Input.Search
              placeholder="Tìm theo email hoặc họ tên..."
              allowClear
              style={{ width: 260 }}
              value={users.search}
              onChange={(event) => users.setSearch(event.target.value)}
              onSearch={users.reload}
            />
            <Select
              placeholder="Lọc vai trò"
              allowClear
              style={{ width: 150 }}
              value={users.role || undefined}
              onChange={(value) => users.setRole(value || '')}
              options={roleOptions}
            />
            <Button onClick={users.reload} icon={<RefreshCw size={14} />}>Làm mới</Button>
          </Space>
        </Space>
        <Table
          scroll={{ x: 720 }}
          dataSource={users.list}
          columns={columns}
          rowKey="id"
          loading={users.loading}
          pagination={{ pageSize: 8 }}
          size="middle"
        />
      </Card>

      <Modal
        title="Chỉnh sửa tài khoản"
        open={Boolean(users.editUser)}
        onCancel={users.closeEdit}
        footer={null}
        destroyOnHidden
      >
        <Form form={form} layout="vertical" onFinish={users.update}>
          <Form.Item label="Email"><Input disabled value={users.editUser?.email} /></Form.Item>
          <Form.Item name="role" label="Vai trò" rules={[{ required: true }]}>
            <Select options={roleOptions} />
          </Form.Item>
          <Form.Item name="isActive" label="Trạng thái" valuePropName="checked">
            <Switch checkedChildren="Hoạt động" unCheckedChildren="Đã khóa" />
          </Form.Item>
          <Button type="primary" htmlType="submit" block>Lưu thay đổi</Button>
        </Form>
      </Modal>
    </>
  );
}
