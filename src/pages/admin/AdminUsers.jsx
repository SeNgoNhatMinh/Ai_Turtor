import { useEffect, useMemo, useState } from 'react';
import { Card, Table, Button, Form, Input, Select, Upload, Typography, Tag, Space, Alert, Divider, Tabs, Modal, Switch } from 'antd';
import {
  Users as UsersIcon, GraduationCap, AlertTriangle, RefreshCw,
  Inbox, Trash2, Edit, UserCheck
} from 'lucide-react';
import { adminUsersApi } from '../../services/adminUsersApi';
import { getUserFacingError } from '../../services/apiClient';
import { confirmDanger } from '../../components/common/confirmDialog';
import { ACCOUNT_ROLES } from '../../constants/roles';
import { findPersonById, getPersonDisplayName, getPersonEmail } from '../../utils/displayNames';

const { Title } = Typography;
const { Dragger } = Upload;
const { Option } = Select;

function AdminUsers({ triggerToast, handleAdminImport }) {
  const [adminImportLog, setAdminImportLog] = useState(null);

  // Users
  const [usersList, setUsersList] = useState([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [userSearchQ, setUserSearchQ] = useState('');
  const [userFilterRole, setUserFilterRole] = useState('');
  const [editUserModal, setEditUserModal] = useState(null);

  // Mentors
  const [mentorsList, setMentorsList] = useState([]);
  const [mentorsLoading, setMentorsLoading] = useState(false);
  const [mentorRoleOverrides, setMentorRoleOverrides] = useState({});
  const [updatingTeacherRoleId, setUpdatingTeacherRoleId] = useState('');

  // Escalations
  const [escalationsList, setEscalationsList] = useState([]);
  const [escalationsLoading, setEscalationsLoading] = useState(false);

  const [formEditUser] = Form.useForm();

  // ── Loaders ──────────────────────────────────────────────
  const loadUsers = async () => {
    setUsersLoading(true);
    const data = await adminUsersApi.getAdminUsers(userSearchQ, userFilterRole);
    setUsersList(Array.isArray(data) ? data : []);
    setUsersLoading(false);
  };
  const loadMentors = async () => {
    setMentorsLoading(true);
    const data = await adminUsersApi.getAdminMentors();
    setMentorsList(Array.isArray(data) ? data : []);
    setMentorsLoading(false);
  };
  const loadEscalations = async () => {
    setEscalationsLoading(true);
    const data = await adminUsersApi.getAdminEscalations();
    setEscalationsList(Array.isArray(data) ? data : []);
    setEscalationsLoading(false);
  };

  useEffect(() => {
    const loadTimer = window.setTimeout(() => {
      loadUsers();
      loadMentors();
      loadEscalations();
    }, 0);
    return () => window.clearTimeout(loadTimer);
    // Initial lists are intentionally loaded once; filters are applied explicitly.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Handlers ─────────────────────────────────────────────
  const handleDeleteUser = async (userId) => {
    await adminUsersApi.deleteAdminUser(userId);
    triggerToast('User deleted.');
    setUsersList(prev => prev.filter(u => u.id !== userId));
  };
  const handleUpdateUser = async (values) => {
    await adminUsersApi.updateAdminUser(editUserModal.id, values);
    triggerToast('User updated.');
    setEditUserModal(null);
    loadUsers();
  };
  const handleDeleteMentor = async (mentorId) => {
    await adminUsersApi.deleteAdminMentor(mentorId);
    triggerToast('Mentor deleted.');
    setMentorsList(prev => prev.filter(m => m.id !== mentorId));
  };
  const handleToggleMentor = async (mentorId, field, value) => {
    await adminUsersApi.updateAdminMentor(mentorId, { [field]: value });
    triggerToast('Mentor status updated.');
    setMentorsList(prev => prev.map(m => m.id === mentorId ? { ...m, [field]: value } : m));
  };
  const getMentorAccountRole = (mentor) => {
    if (mentorRoleOverrides[mentor.id]) return mentorRoleOverrides[mentor.id];
    const mentorEmail = String(mentor.email || '').trim().toLowerCase();
    const account = usersList.find((user) => (
      user.id === mentor.id
      || (mentorEmail && String(user.email || '').trim().toLowerCase() === mentorEmail)
    ));
    return account?.role === ACCOUNT_ROLES.SENIOR_MENTOR
      ? ACCOUNT_ROLES.SENIOR_MENTOR
      : ACCOUNT_ROLES.TEACHER;
  };
  const handleTeacherRoleChange = async (mentor, nextRole) => {
    if (!mentor?.id || updatingTeacherRoleId) return;
    setUpdatingTeacherRoleId(mentor.id);
    try {
      const response = await adminUsersApi.updateTeacherRole(mentor.id, nextRole);
      const resolvedRole = response?.role || nextRole;
      setMentorRoleOverrides((current) => ({ ...current, [mentor.id]: resolvedRole }));
      setUsersList((current) => current.map((user) => (
        user.id === mentor.id || String(user.email || '').toLowerCase() === String(mentor.email || '').toLowerCase()
          ? { ...user, role: resolvedRole }
          : user
      )));
      triggerToast(response?.message || 'Teacher role updated. The teacher must sign in again.');
    } catch (error) {
      triggerToast(getUserFacingError(error, 'Unable to update this teacher role.'));
    } finally {
      setUpdatingTeacherRoleId('');
    }
  };
  const handleDeleteEscalation = async (escId) => {
    await adminUsersApi.deleteAdminEscalation(escId);
    triggerToast('Support request deleted.');
    setEscalationsList(prev => prev.filter(e => e.id !== escId));
  };
  const onAdminImport = (file) => {
    handleAdminImport(file).then((log) => setAdminImportLog(log));
    return false;
  };

  const confirmDelete = (event, { title, content, onOk }) => {
    event.stopPropagation();
    confirmDanger({
      title,
      content,
      anchorRect: event.currentTarget?.getBoundingClientRect?.(),
      onOk,
    });
  };

  // ── Columns ──────────────────────────────────────────────
  const userColumns = [
    { title: 'Email', dataIndex: 'email', key: 'email', ellipsis: true },
    { title: 'Full Name', dataIndex: 'fullName', key: 'fullName', render: (v) => v || '—' },
    {
      title: 'Role', dataIndex: 'role', key: 'role', width: 120,
      render: (role) => {
        const color = role === ACCOUNT_ROLES.ADMIN
          ? 'volcano'
          : role === ACCOUNT_ROLES.SENIOR_MENTOR
            ? 'purple'
            : role === ACCOUNT_ROLES.TEACHER
              ? 'geekblue'
              : 'green';
        return <Tag color={color}>{role || ACCOUNT_ROLES.STUDENT}</Tag>;
      }
    },
    {
      title: 'Status', dataIndex: 'isActive', key: 'isActive', width: 100,
      render: (v) => <Tag color={v !== false ? 'success' : 'default'}>{v !== false ? 'Active' : 'Inactive'}</Tag>
    },
    {
      title: 'Actions', key: 'action', width: 160,
      render: (_, record) => (
        <Space>
          <Button
            type="link" size="small" icon={<Edit size={14} />}
            onClick={() => { setEditUserModal(record); formEditUser.setFieldsValue({ role: record.role, isActive: record.isActive !== false }); }}
          />
          <Button
            type="link"
            danger
            size="small"
            icon={<Trash2 size={14} />}
            onClick={(event) => confirmDelete(event, {
              title: 'Delete this user?',
              content: 'This removes the account from the platform.',
              onOk: () => handleDeleteUser(record.id),
            })}
          />
        </Space>
      )
    }
  ];

  const mentorColumns = useMemo(() => [
    { title: 'Name', dataIndex: 'mentorName', key: 'name', render: (value, record) => value || record.name || '—' },
    { title: 'Email', dataIndex: 'email', key: 'email', ellipsis: true },
    {
      title: 'Specialization',
      dataIndex: 'specializations',
      key: 'spec',
      ellipsis: true,
      render: (value, record) => (Array.isArray(value) ? value.join(', ') : value || record.specialization || '—'),
    },
    {
      title: 'Account Role',
      key: 'role',
      width: 150,
      render: (_, record) => {
        const role = getMentorAccountRole(record);
        return <Tag color={role === ACCOUNT_ROLES.SENIOR_MENTOR ? 'purple' : 'geekblue'}>{role}</Tag>;
      },
    },
    {
      title: 'Active', dataIndex: 'isActive', key: 'active', width: 80,
      render: (v, record) => <Switch size="small" checked={v !== false} onChange={(checked) => handleToggleMentor(record.id, 'isActive', checked)} />
    },
    {
      title: 'Verified', dataIndex: 'verified', key: 'verified', width: 90,
      render: (v, record) => <Switch size="small" checked={!!v} checkedChildren={<UserCheck size={12} />} onChange={(checked) => handleToggleMentor(record.id, 'verified', checked)} />
    },
    {
      title: 'Actions', key: 'action', width: 220,
      render: (_, record) => {
        const currentRole = getMentorAccountRole(record);
        const nextRole = currentRole === ACCOUNT_ROLES.SENIOR_MENTOR
          ? ACCOUNT_ROLES.TEACHER
          : ACCOUNT_ROLES.SENIOR_MENTOR;
        return (
          <Space size={4}>
            <Button
              size="small"
              loading={updatingTeacherRoleId === record.id}
              disabled={Boolean(updatingTeacherRoleId && updatingTeacherRoleId !== record.id)}
              onClick={() => handleTeacherRoleChange(record, nextRole)}
            >
              {nextRole === ACCOUNT_ROLES.SENIOR_MENTOR ? 'Promote to Senior' : 'Change to Teacher'}
            </Button>
            <Button
              type="link"
              danger
              size="small"
              icon={<Trash2 size={14} />}
              aria-label={`Delete ${record.mentorName || record.name || 'mentor'}`}
              onClick={(event) => confirmDelete(event, {
                title: 'Delete this mentor?',
                content: 'This removes the mentor profile and cannot be undone.',
                onOk: () => handleDeleteMentor(record.id),
              })}
            />
          </Space>
        );
      },
    }
  // Functions are local to this screen and intentionally captured by the table column renderers.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [mentorRoleOverrides, updatingTeacherRoleId, usersList]);

  const escalationColumns = [
    {
      title: 'Student',
      dataIndex: 'userId',
      key: 'userId',
      render: (value, record) => {
        const account = findPersonById(usersList, record.studentId || value);
        const displayRecord = { ...(account || {}), ...record };
        const email = getPersonEmail(displayRecord);
        return (
          <div className="entity-name-cell">
            <strong>{getPersonDisplayName(displayRecord, 'Student')}</strong>
            {email && <span>{email}</span>}
          </div>
        );
      },
    },
    { title: 'Question', dataIndex: 'question', key: 'question', ellipsis: true, render: (v) => v || '—' },
    {
      title: 'Status', dataIndex: 'status', key: 'status', width: 120,
      render: (v) => <Tag color={v === 'RESOLVED' ? 'green' : v === 'PENDING' ? 'orange' : 'blue'}>{v || 'PENDING'}</Tag>
    },
    {
      title: '', key: 'action', width: 50,
      render: (_, record) => (
        <Button
          type="link"
          danger
          size="small"
          icon={<Trash2 size={14} />}
          onClick={(event) => confirmDelete(event, {
            title: 'Delete this support request?',
            content: 'This removes the support request from admin review.',
            onOk: () => handleDeleteEscalation(record.id),
          })}
        />
      )
    }
  ];

  const adminUserTabs = [
    {
      key: 'users',
      label: <><UsersIcon size={14} style={{ marginRight: 6, verticalAlign: 'text-bottom' }} />Users ({usersList.length})</>,
      children: (
        <Card hoverable>
          <Space style={{ marginBottom: 16, width: '100%', justifyContent: 'space-between' }}>
            <Space>
              <Input.Search
                placeholder="Search email or name..."
                allowClear
                style={{ width: 260 }}
                value={userSearchQ}
                onChange={(event) => setUserSearchQ(event.target.value)}
                onSearch={loadUsers}
              />
              <Select
                placeholder="Filter role"
                allowClear
                style={{ width: 150 }}
                value={userFilterRole || undefined}
                onChange={(value) => setUserFilterRole(value || '')}
              >
                <Option value="STUDENT">Student</Option>
                <Option value="TEACHER">Teacher</Option>
                <Option value="SENIOR_MENTOR">Senior Mentor</Option>
                <Option value="ADMIN">Admin</Option>
              </Select>
              <Button onClick={loadUsers} icon={<RefreshCw size={14} />}>Reload</Button>
            </Space>
          </Space>
          <Table dataSource={usersList} columns={userColumns} rowKey="id" loading={usersLoading} pagination={{ pageSize: 8 }} size="middle" />
        </Card>
      ),
    },
    {
      key: 'mentors',
      label: <><GraduationCap size={14} style={{ marginRight: 6, verticalAlign: 'text-bottom' }} />Mentors ({mentorsList.length})</>,
      children: (
        <Card hoverable>
          <Space style={{ marginBottom: 16 }}>
            <Button onClick={loadMentors} icon={<RefreshCw size={14} />}>Reload</Button>
          </Space>
          <Table dataSource={mentorsList} columns={mentorColumns} rowKey="id" loading={mentorsLoading} pagination={{ pageSize: 8 }} size="middle" />
          <Divider />
          <Title level={5}>Import Mentors (Excel)</Title>
          <Dragger name="file" multiple={false} beforeUpload={onAdminImport} accept=".xlsx,.csv" style={{ marginBottom: 16 }}>
            <p className="ant-upload-drag-icon"><Inbox size={40} style={{ color: '#F37021' }} /></p>
            <p className="ant-upload-text">Drag an Excel file here</p>
          </Dragger>
          {adminImportLog && (
            <Alert title="Import Result" description={<pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{adminImportLog}</pre>} type="success" showIcon />
          )}
        </Card>
      ),
    },
    {
      key: 'escalations',
      label: <><AlertTriangle size={14} style={{ marginRight: 6, verticalAlign: 'text-bottom' }} />Support Requests ({escalationsList.length})</>,
      children: (
        <Card hoverable>
          <Space style={{ marginBottom: 16 }}>
            <Button onClick={loadEscalations} icon={<RefreshCw size={14} />}>Reload</Button>
          </Space>
          <Table
            dataSource={escalationsList}
            columns={escalationColumns}
            rowKey="id"
            loading={escalationsLoading}
            pagination={{ pageSize: 8 }}
            size="middle"
            locale={{ emptyText: 'No support requests found' }}
          />
        </Card>
      ),
    },
  ];

  // ── Render ───────────────────────────────────────────────
  return (
    <div className="portal-view">
      <Tabs defaultActiveKey="users" type="card" style={{ marginBottom: 0 }} items={adminUserTabs} />

      {/* Edit user modal */}
      <Modal title="Edit User" open={!!editUserModal} onCancel={() => setEditUserModal(null)} footer={null} destroyOnHidden>
        <Form form={formEditUser} layout="vertical" onFinish={handleUpdateUser}>
          <Form.Item label="Email"><Input disabled value={editUserModal?.email} /></Form.Item>
          <Form.Item name="role" label="Role" rules={[{ required: true }]}>
            <Select>
              <Option value="STUDENT">Student</Option>
              <Option value="TEACHER">Teacher</Option>
              <Option value="SENIOR_MENTOR">Senior Mentor</Option>
              <Option value="ADMIN">Admin</Option>
            </Select>
          </Form.Item>
          <Form.Item name="isActive" label="Status" valuePropName="checked">
            <Switch checkedChildren="Active" unCheckedChildren="Inactive" />
          </Form.Item>
          <Button type="primary" htmlType="submit" block>Save Changes</Button>
        </Form>
      </Modal>
    </div>
  );
}

export default AdminUsers;
