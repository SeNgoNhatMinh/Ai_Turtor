import { useMemo, useState } from 'react';
import { Inbox, RefreshCw, Trash2, UserCheck } from 'lucide-react';
import { Alert, Button, Card, Divider, Input, Space, Switch, Table, Tag, Typography, Upload } from 'antd';
import EntityActionMenu from '../../../../components/common/EntityActionMenu';
import { confirmDanger } from '../../../../components/common/confirmDialog';
import { ACCOUNT_ROLES } from '../../../../constants/roles';

const { Title } = Typography;
const { Dragger } = Upload;

function mentorSearchHaystack(mentor, role) {
  const specializations = Array.isArray(mentor.specializations)
    ? mentor.specializations.join(' ')
    : mentor.specializations || mentor.specialization || '';
  return [
    mentor.mentorName,
    mentor.name,
    mentor.email,
    mentor.phone,
    mentor.mentorCode,
    specializations,
    role,
  ].join(' ').toLowerCase();
}

export default function MentorsTab({ mentors }) {
  const [search, setSearch] = useState('');
  const filteredMentors = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return mentors.list;
    return mentors.list.filter((mentor) => mentorSearchHaystack(mentor, mentors.getRole(mentor)).includes(needle));
  }, [mentors.list, mentors.getRole, search]);

  const columns = [
    { title: 'Họ tên', dataIndex: 'mentorName', key: 'name', render: (value, record) => value || record.name || '—' },
    { title: 'Email', dataIndex: 'email', key: 'email', ellipsis: true },
    {
      title: 'Chuyên môn',
      dataIndex: 'specializations',
      key: 'spec',
      ellipsis: true,
      render: (value, record) => (Array.isArray(value) ? value.join(', ') : value || record.specialization || '—'),
    },
    {
      title: 'Vai trò tài khoản',
      key: 'role',
      width: 150,
      render: (_, record) => {
        const role = mentors.getRole(record);
        return <Tag color={role === ACCOUNT_ROLES.SENIOR_MENTOR ? 'purple' : 'geekblue'}>{role}</Tag>;
      },
    },
    {
      title: 'Hoạt động',
      dataIndex: 'isActive',
      key: 'active',
      width: 90,
      render: (value, record) => (
        <Switch size="small" checked={value !== false} onChange={(checked) => mentors.toggle(record.id, 'isActive', checked)} />
      ),
    },
    {
      title: 'Đã xác minh',
      dataIndex: 'verified',
      key: 'verified',
      width: 100,
      render: (value, record) => (
        <Switch
          size="small"
          checked={Boolean(value)}
          checkedChildren={<UserCheck size={12} />}
          onChange={(checked) => mentors.toggle(record.id, 'verified', checked)}
        />
      ),
    },
    {
      title: '',
      key: 'action',
      width: 56,
      render: (_, record) => {
        const currentRole = mentors.getRole(record);
        const nextRole = currentRole === ACCOUNT_ROLES.SENIOR_MENTOR
          ? ACCOUNT_ROLES.TEACHER
          : ACCOUNT_ROLES.SENIOR_MENTOR;
        return (
          <EntityActionMenu
            disabled={Boolean(mentors.updatingRoleId)}
            items={[
              {
                key: 'role',
                icon: <UserCheck size={14} />,
                label: nextRole === ACCOUNT_ROLES.SENIOR_MENTOR ? 'Nâng lên Senior Mentor' : 'Chuyển về Teacher',
              },
              { type: 'divider' },
              { key: 'delete', icon: <Trash2 size={14} />, label: 'Xóa hồ sơ giảng viên', danger: true },
            ]}
            ariaLabel={`Thao tác với ${record.mentorName || record.name || 'giảng viên'}`}
            onAction={(key, meta) => {
              if (key === 'role') mentors.changeRole(record, nextRole);
              if (key === 'delete') {
                confirmDanger({
                  title: 'Xóa hồ sơ giảng viên này?',
                  content: 'Hồ sơ giảng viên sẽ bị xóa và không thể hoàn tác.',
                  anchorRect: meta?.anchorRect,
                  onOk: () => mentors.remove(record.id),
                });
              }
            }}
          />
        );
      },
    },
  ];

  return (
    <Card hoverable>
      <Space style={{ marginBottom: 16, width: '100%', justifyContent: 'space-between' }}>
        <Space wrap>
          <Input.Search
            placeholder="Tìm theo tên, email hoặc chuyên môn..."
            allowClear
            style={{ width: 280 }}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            onSearch={setSearch}
          />
          <Button onClick={mentors.reload} icon={<RefreshCw size={14} />}>Làm mới</Button>
        </Space>
      </Space>
      <Table
        scroll={{ x: 920 }}
        dataSource={filteredMentors}
        columns={columns}
        rowKey="id"
        loading={mentors.loading}
        pagination={{ pageSize: 8 }}
        size="middle"
        locale={{ emptyText: search.trim() ? 'Không tìm thấy giảng viên phù hợp.' : 'Chưa có giảng viên.' }}
      />
      <Divider />
      <Title level={5}>Import giảng viên từ Excel</Title>
      <Dragger name="file" multiple={false} beforeUpload={mentors.importFile} accept=".xlsx,.csv" style={{ marginBottom: 16 }}>
        <p className="ant-upload-drag-icon"><Inbox size={40} style={{ color: '#F37021' }} /></p>
        <p className="ant-upload-text">Kéo tệp Excel vào đây hoặc bấm để chọn</p>
      </Dragger>
      {mentors.importLog && (
        <Alert
          title="Kết quả import"
          description={<pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{mentors.importLog}</pre>}
          type="success"
          showIcon
        />
      )}
    </Card>
  );
}
