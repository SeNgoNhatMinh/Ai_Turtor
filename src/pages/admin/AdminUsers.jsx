import React, { useState, useEffect } from 'react';
import { Card, Table, Button, Form, Input, Select, Upload, Typography, Tag, Space, Alert, Divider, Tabs, Modal, Popconfirm, Switch, message } from 'antd';
import {
  Users as UsersIcon, GraduationCap, AlertTriangle, RefreshCw,
  Upload as UploadIcon, Inbox, Trash2, Edit, UserCheck
} from 'lucide-react';
import { apiService } from '../../services/api';

const { Title, Text } = Typography;
const { Dragger } = Upload;
const { Option } = Select;
const { TabPane } = Tabs;

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

  // Escalations
  const [escalationsList, setEscalationsList] = useState([]);
  const [escalationsLoading, setEscalationsLoading] = useState(false);

  const [formEditUser] = Form.useForm();

  useEffect(() => {
    loadUsers();
    loadMentors();
    loadEscalations();
  }, []);

  // ── Loaders ──────────────────────────────────────────────
  const loadUsers = async () => {
    setUsersLoading(true);
    const data = await apiService.getAdminUsers(userSearchQ, userFilterRole);
    setUsersList(Array.isArray(data) ? data : []);
    setUsersLoading(false);
  };
  const loadMentors = async () => {
    setMentorsLoading(true);
    const data = await apiService.getAdminMentors();
    setMentorsList(Array.isArray(data) ? data : []);
    setMentorsLoading(false);
  };
  const loadEscalations = async () => {
    setEscalationsLoading(true);
    const data = await apiService.getAdminEscalations();
    setEscalationsList(Array.isArray(data) ? data : []);
    setEscalationsLoading(false);
  };

  // ── Handlers ─────────────────────────────────────────────
  const handleDeleteUser = async (userId) => {
    await apiService.deleteAdminUser(userId);
    triggerToast('User deleted.');
    setUsersList(prev => prev.filter(u => u.id !== userId));
  };
  const handleUpdateUser = async (values) => {
    await apiService.updateAdminUser(editUserModal.id, values);
    triggerToast('User updated.');
    setEditUserModal(null);
    loadUsers();
  };
  const handleDeleteMentor = async (mentorId) => {
    await apiService.deleteAdminMentor(mentorId);
    triggerToast('Mentor deleted.');
    setMentorsList(prev => prev.filter(m => m.id !== mentorId));
  };
  const handleToggleMentor = async (mentorId, field, value) => {
    await apiService.updateAdminMentor(mentorId, { [field]: value });
    triggerToast('Mentor status updated.');
    setMentorsList(prev => prev.map(m => m.id === mentorId ? { ...m, [field]: value } : m));
  };
  const handleDeleteEscalation = async (escId) => {
    await apiService.deleteAdminEscalation(escId);
    triggerToast('Support request deleted.');
    setEscalationsList(prev => prev.filter(e => e.id !== escId));
  };
  const onAdminImport = (file) => {
    handleAdminImport(file).then((log) => setAdminImportLog(log));
    return false;
  };

  // ── Columns ──────────────────────────────────────────────
  const userColumns = [
    { title: 'Email', dataIndex: 'email', key: 'email', ellipsis: true },
    { title: 'Full Name', dataIndex: 'fullName', key: 'fullName', render: (v) => v || '—' },
    {
      title: 'Role', dataIndex: 'role', key: 'role', width: 120,
      render: (role) => {
        const color = role === 'ADMIN' ? 'volcano' : role === 'TEACHER' ? 'geekblue' : 'green';
        return <Tag color={color}>{role || 'STUDENT'}</Tag>;
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
          <Popconfirm title="Delete this user?" onConfirm={() => handleDeleteUser(record.id)} okText="Delete" cancelText="Cancel">
            <Button type="link" danger size="small" icon={<Trash2 size={14} />} />
          </Popconfirm>
        </Space>
      )
    }
  ];

  const mentorColumns = [
    { title: 'Name', dataIndex: 'name', key: 'name', render: (v) => v || '—' },
    { title: 'Email', dataIndex: 'email', key: 'email', ellipsis: true },
    { title: 'Specialization', dataIndex: 'specialization', key: 'spec', ellipsis: true, render: (v) => v || '—' },
    {
      title: 'Active', dataIndex: 'isActive', key: 'active', width: 80,
      render: (v, record) => <Switch size="small" checked={v !== false} onChange={(checked) => handleToggleMentor(record.id, 'isActive', checked)} />
    },
    {
      title: 'Verified', dataIndex: 'verified', key: 'verified', width: 90,
      render: (v, record) => <Switch size="small" checked={!!v} checkedChildren={<UserCheck size={12} />} onChange={(checked) => handleToggleMentor(record.id, 'verified', checked)} />
    },
    {
      title: '', key: 'action', width: 50,
      render: (_, record) => (
        <Popconfirm title="Delete this mentor?" onConfirm={() => handleDeleteMentor(record.id)} okText="Delete" cancelText="Cancel">
          <Button type="link" danger size="small" icon={<Trash2 size={14} />} />
        </Popconfirm>
      )
    }
  ];

  const escalationColumns = [
    { title: 'ID', dataIndex: 'id', key: 'id', width: 100, ellipsis: true },
    { title: 'Student', dataIndex: 'userId', key: 'userId', render: (v) => v || '—' },
    { title: 'Question', dataIndex: 'question', key: 'question', ellipsis: true, render: (v) => v || '—' },
    {
      title: 'Status', dataIndex: 'status', key: 'status', width: 120,
      render: (v) => <Tag color={v === 'RESOLVED' ? 'green' : v === 'PENDING' ? 'orange' : 'blue'}>{v || 'PENDING'}</Tag>
    },
    {
      title: '', key: 'action', width: 50,
      render: (_, record) => (
        <Popconfirm title="Delete this support request?" onConfirm={() => handleDeleteEscalation(record.id)} okText="Delete" cancelText="Cancel">
          <Button type="link" danger size="small" icon={<Trash2 size={14} />} />
        </Popconfirm>
      )
    }
  ];

  // ── Render ───────────────────────────────────────────────
  return (
    <div className="portal-view">
      <Tabs defaultActiveKey="users" type="card" style={{ marginBottom: 0 }}>
        {/* Users */}
        <TabPane tab={<><UsersIcon size={14} style={{ marginRight: 6, verticalAlign: 'text-bottom' }} />Users ({usersList.length})</>} key="users">
          <Card hoverable>
            <Space style={{ marginBottom: 16, width: '100%', justifyContent: 'space-between' }}>
              <Space>
                <Input.Search
                  placeholder="Search email or name..." allowClear style={{ width: 260 }}
                  value={userSearchQ} onChange={e => setUserSearchQ(e.target.value)} onSearch={loadUsers}
                />
                <Select placeholder="Filter role" allowClear style={{ width: 150 }} value={userFilterRole || undefined} onChange={v => setUserFilterRole(v || '')}>
                  <Option value="STUDENT">Student</Option>
                  <Option value="TEACHER">Teacher</Option>
                  <Option value="ADMIN">Admin</Option>
                </Select>
                <Button onClick={loadUsers} icon={<RefreshCw size={14} />}>Reload</Button>
              </Space>
            </Space>
            <Table dataSource={usersList} columns={userColumns} rowKey="id" loading={usersLoading} pagination={{ pageSize: 8 }} size="middle" />
          </Card>
        </TabPane>

        {/* Mentors */}
        <TabPane tab={<><GraduationCap size={14} style={{ marginRight: 6, verticalAlign: 'text-bottom' }} />Mentors ({mentorsList.length})</>} key="mentors">
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
              <Alert message="Import Result:" description={<pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{adminImportLog}</pre>} type="success" showIcon />
            )}
          </Card>
        </TabPane>

        {/* Support Requests */}
        <TabPane tab={<><AlertTriangle size={14} style={{ marginRight: 6, verticalAlign: 'text-bottom' }} />Support Requests ({escalationsList.length})</>} key="escalations">
          <Card hoverable>
            <Space style={{ marginBottom: 16 }}>
              <Button onClick={loadEscalations} icon={<RefreshCw size={14} />}>Reload</Button>
            </Space>
            <Table dataSource={escalationsList} columns={escalationColumns} rowKey="id" loading={escalationsLoading} pagination={{ pageSize: 8 }} size="middle" locale={{ emptyText: 'No support requests found' }} />
          </Card>
        </TabPane>
      </Tabs>

      {/* Edit user modal */}
      <Modal title="Edit User" open={!!editUserModal} onCancel={() => setEditUserModal(null)} footer={null} destroyOnClose>
        <Form form={formEditUser} layout="vertical" onFinish={handleUpdateUser}>
          <Form.Item label="Email"><Input disabled value={editUserModal?.email} /></Form.Item>
          <Form.Item name="role" label="Role" rules={[{ required: true }]}>
            <Select>
              <Option value="STUDENT">Student</Option>
              <Option value="TEACHER">Teacher</Option>
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
