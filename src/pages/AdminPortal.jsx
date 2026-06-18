import React, { useState, useEffect } from 'react';
import { Row, Col, Card, Statistic, Table, Button, Form, Input, InputNumber, Select, Upload, Typography, Tag, Space, Alert, Divider, Tabs, Modal, Popconfirm, Badge, Tooltip, Switch, message } from 'antd';
import { 
  Users as UsersIcon, GraduationCap, MessageSquare, CheckCircle, RefreshCw, 
  Upload as UploadIcon, Edit, Image as ImageIcon, Inbox, BarChart3, Users, 
  Zap, ShieldCheck, Trash2, Plus, Search, UserCheck, BookOpen, CreditCard,
  AlertTriangle, Eye, Download
} from 'lucide-react';
import { apiService } from '../services/api';

const { Title, Text, Paragraph } = Typography;
const { Dragger } = Upload;
const { Option } = Select;
const { TabPane } = Tabs;

function AdminPortal({
  activeTab,
  adminStats,
  diagnosticsOutput,
  isDiagnosticsRunning,
  runDiagnostics,
  adminPlans,
  handleAdminImport,
  triggerToast
}) {
  // ============ LOCAL STATE ============
  const [adminImportLog, setAdminImportLog] = useState(null);

  // Users state
  const [usersList, setUsersList] = useState([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [userSearchQ, setUserSearchQ] = useState('');
  const [userFilterRole, setUserFilterRole] = useState('');
  const [editUserModal, setEditUserModal] = useState(null);

  // Mentors state
  const [mentorsList, setMentorsList] = useState([]);
  const [mentorsLoading, setMentorsLoading] = useState(false);

  // Escalations state
  const [escalationsList, setEscalationsList] = useState([]);
  const [escalationsLoading, setEscalationsLoading] = useState(false);

  // Academic state
  const [semesters, setSemesters] = useState([]);
  const [courses, setCourses] = useState([]);
  const [classSections, setClassSections] = useState([]);
  const [selectedCourseId, setSelectedCourseId] = useState('');
  const [academicLoading, setAcademicLoading] = useState(false);

  // Subscriptions state
  const [subscriptions, setSubscriptions] = useState([]);
  const [subsLoading, setSubsLoading] = useState(false);
  const [assignModal, setAssignModal] = useState(false);

  // Forms
  const [formSemester] = Form.useForm();
  const [formCourse] = Form.useForm();
  const [formClass] = Form.useForm();
  const [formAssign] = Form.useForm();
  const [formEditUser] = Form.useForm();

  // ============ DATA LOADING ============
  useEffect(() => {
    if (activeTab === 'admin-users') {
      loadUsers(); loadMentors(); loadEscalations();
    } else if (activeTab === 'admin-academic') {
      loadSemesters(); loadCourses();
    } else if (activeTab === 'admin-billing') {
      loadSubscriptions();
    }
  }, [activeTab]);

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
  const loadSemesters = async () => {
    const data = await apiService.getSemesters();
    setSemesters(Array.isArray(data) ? data : []);
  };
  const loadCourses = async () => {
    const data = await apiService.getCourses();
    setCourses(Array.isArray(data) ? data : []);
  };
  const loadClassSections = async (courseId) => {
    setAcademicLoading(true);
    const data = await apiService.getClassSections(courseId);
    setClassSections(Array.isArray(data) ? data : []);
    setAcademicLoading(false);
  };
  const loadSubscriptions = async () => {
    setSubsLoading(true);
    const data = await apiService.getAdminSubscriptions();
    setSubscriptions(Array.isArray(data) ? data : []);
    setSubsLoading(false);
  };

  // ============ HANDLERS ============
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

  // Academic handlers
  const handleCreateSemester = async (values) => {
    await apiService.createSemester({ semesterCode: values.semesterCode, name: values.name, status: 'ACTIVE' });
    triggerToast('New term created.');
    formSemester.resetFields();
    loadSemesters();
  };
  const handleCreateCourse = async (values) => {
    await apiService.createCourse({ courseId: values.courseId, courseName: values.courseName, credits: values.credits, status: 'ACTIVE' });
    triggerToast('New course created.');
    formCourse.resetFields();
    loadCourses();
  };
  const handleCreateClass = async (values) => {
    await apiService.createClassSection({ courseId: values.courseId, classId: values.classCode, teacherId: values.teacherId, status: 'ACTIVE' });
    triggerToast('New class section created.');
    formClass.resetFields();
    if (selectedCourseId) loadClassSections(selectedCourseId);
  };

  // Billing handlers
  const handleDeletePlan = async (planId) => {
    await apiService.deleteSubscriptionPlan(planId);
    triggerToast('Plan deleted.');
  };
  const handleAssignSub = async (values) => {
    await apiService.assignSubscription(values);
    triggerToast('Plan assigned to user.');
    setAssignModal(false);
    formAssign.resetFields();
    loadSubscriptions();
  };
  const handleDeleteSub = async (subId) => {
    await apiService.deleteSubscription(subId);
    triggerToast('Subscription deleted.');
    setSubscriptions(prev => prev.filter(s => s.id !== subId));
  };

  const onAdminImport = (file) => {
    handleAdminImport(file).then((log) => setAdminImportLog(log));
    return false;
  };

  // ============ COLUMN DEFINITIONS ============
  const userColumns = [
    { title: 'Email', dataIndex: 'email', key: 'email', ellipsis: true },
    { title: 'Full Name', dataIndex: 'fullName', key: 'fullName', render: (v) => v || '—' },
    { title: 'Role', dataIndex: 'role', key: 'role', width: 120,
      render: (role) => {
        const color = role === 'ADMIN' ? 'volcano' : role === 'TEACHER' ? 'geekblue' : 'green';
        return <Tag color={color}>{role || 'STUDENT'}</Tag>;
      }
    },
    { title: 'Status', dataIndex: 'isActive', key: 'isActive', width: 100,
      render: (v) => <Tag color={v !== false ? 'success' : 'default'}>{v !== false ? 'Active' : 'Inactive'}</Tag>
    },
    { title: 'Actions', key: 'action', width: 160,
      render: (_, record) => (
        <Space>
          <Tooltip title="Edit">
            <Button type="link" size="small" icon={<Edit size={14} />} onClick={() => { setEditUserModal(record); formEditUser.setFieldsValue({ role: record.role, isActive: record.isActive !== false }); }} />
          </Tooltip>
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
    { title: 'Active', dataIndex: 'isActive', key: 'active', width: 80,
      render: (v, record) => <Switch size="small" checked={v !== false} onChange={(checked) => handleToggleMentor(record.id, 'isActive', checked)} />
    },
    { title: 'Verified', dataIndex: 'verified', key: 'verified', width: 90,
      render: (v, record) => <Switch size="small" checked={!!v} checkedChildren={<UserCheck size={12} />} onChange={(checked) => handleToggleMentor(record.id, 'verified', checked)} />
    },
    { title: '', key: 'action', width: 50,
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
    { title: 'Status', dataIndex: 'status', key: 'status', width: 120,
      render: (v) => <Tag color={v === 'RESOLVED' ? 'green' : v === 'PENDING' ? 'orange' : 'blue'}>{v || 'PENDING'}</Tag>
    },
    { title: '', key: 'action', width: 50,
      render: (_, record) => (
        <Popconfirm title="Delete this support request?" onConfirm={() => handleDeleteEscalation(record.id)} okText="Delete" cancelText="Cancel">
          <Button type="link" danger size="small" icon={<Trash2 size={14} />} />
        </Popconfirm>
      )
    }
  ];

  const planColumns = [
    { title: 'Plan Name', dataIndex: 'name', key: 'name' },
    { title: 'Code', dataIndex: 'code', key: 'code', render: (v) => <Tag color="gold">{v}</Tag> },
    { title: 'Price', dataIndex: 'price', key: 'price', render: (v, r) => <Text strong style={{ color: '#F37021' }}>{(v || 0).toLocaleString('vi-VN')} {r.currency || 'VND'}</Text> },
    { title: 'Description', dataIndex: 'description', key: 'desc', ellipsis: true },
    { title: '', key: 'action', width: 50,
      render: (_, record) => (
        <Popconfirm title="Delete this plan?" onConfirm={() => handleDeletePlan(record.id || record.code)}>
          <Button type="link" danger size="small" icon={<Trash2 size={14} />} />
        </Popconfirm>
      )
    }
  ];

  const subColumns = [
    { title: 'User ID', dataIndex: 'userId', key: 'userId', ellipsis: true },
    { title: 'Plan', dataIndex: 'planCode', key: 'plan', render: (v) => <Tag color="gold">{v || '—'}</Tag> },
    { title: 'Status', dataIndex: 'status', key: 'status', render: (v) => <Tag color={v === 'ACTIVE' ? 'green' : 'default'}>{v || '—'}</Tag> },
    { title: 'Start Date', dataIndex: 'startAt', key: 'start', render: (v) => v ? new Date(v).toLocaleDateString('vi-VN') : '—' },
    { title: '', key: 'action', width: 50,
      render: (_, record) => (
        <Popconfirm title="Delete this subscription?" onConfirm={() => handleDeleteSub(record.id)}>
          <Button type="link" danger size="small" icon={<Trash2 size={14} />} />
        </Popconfirm>
      )
    }
  ];

  // ============ RENDER ============
  return (
    <div style={{ padding: '0 24px 24px 24px' }}>
      {/* ================= TAB: OVERVIEW DASHBOARD ================= */}
      {activeTab === 'admin-dashboard' && (
        <div className="portal-view">
          <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
            <Col xs={12} lg={6}>
              <Card hoverable className="glass-card" style={{ borderLeft: '3px solid #F37021' }}>
                <Statistic title={<Text type="secondary">Total Users</Text>} value={adminStats.users ?? adminStats.totalUsers ?? 0} valueStyle={{ color: '#F37021', fontWeight: 700 }} prefix={<Users size={20} />} />
              </Card>
            </Col>
            <Col xs={12} lg={6}>
              <Card hoverable className="glass-card" style={{ borderLeft: '3px solid #52c41a' }}>
                <Statistic title={<Text type="secondary">Mentors</Text>} value={adminStats.mentors ?? 0} valueStyle={{ color: '#52c41a', fontWeight: 700 }} prefix={<GraduationCap size={20} />} />
              </Card>
            </Col>
            <Col xs={12} lg={6}>
              <Card hoverable className="glass-card" style={{ borderLeft: '3px solid #F37021' }}>
                <Statistic title={<Text type="secondary">Subscriptions</Text>} value={adminStats.subscriptions ?? 0} valueStyle={{ color: '#F37021', fontWeight: 700 }} prefix={<Zap size={20} />} />
              </Card>
            </Col>
            <Col xs={12} lg={6}>
              <Card hoverable className="glass-card" style={{ borderLeft: '3px solid #fa8c16' }}>
                <Statistic title={<Text type="secondary">Support Requests</Text>} value={adminStats.escalations ?? 0} valueStyle={{ color: '#fa8c16', fontWeight: 700 }} prefix={<AlertTriangle size={20} />} />
              </Card>
            </Col>
          </Row>

          <Row gutter={[16, 16]}>
            <Col xs={24} lg={12}>
              <Card title={<><BarChart3 size={16} style={{ verticalAlign: 'text-bottom', marginRight: 8 }}/>Weekly Query Activity</>} hoverable>
                <div style={{ display: 'flex', flexDirection: 'column', height: 200, justifyContent: 'flex-end', alignItems: 'center' }}>
                  <Text type="secondary">Chart is being updated...</Text>
                  <div style={{ marginTop: 'auto', display: 'flex', justifyContent: 'space-between', width: '100%', padding: '0 20px' }}>
                    <Text>Mon</Text><Text>Tue</Text><Text>Wed</Text><Text>Thu</Text><Text>Fri</Text><Text>Sat</Text><Text>Sun</Text>
                  </div>
                </div>
              </Card>
            </Col>
            <Col xs={24} lg={12}>
              <Card 
                title="System Diagnostics" 
                extra={<Button type="primary" icon={<RefreshCw size={14} className={isDiagnosticsRunning ? 'spinning' : ''} />} onClick={runDiagnostics} loading={isDiagnosticsRunning}>Run Check</Button>}
                hoverable
              >
                {diagnosticsOutput ? (
                  <Space direction="vertical" style={{ width: '100%' }} size="middle">
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}><Text>OpenRouter API Key:</Text><Tag color={diagnosticsOutput.apiKeyValid ? 'success' : 'error'}>{diagnosticsOutput.apiKeyValid ? 'Valid' : 'Error'}</Tag></div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}><Text>OpenRouter Connection:</Text><Tag color={diagnosticsOutput.openRouterConnectivity ? 'success' : 'error'}>{diagnosticsOutput.openRouterConnectivity ? 'Connected' : 'Offline'}</Tag></div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}><Text>Ollama (Embedding):</Text><Tag color={diagnosticsOutput.ollamaConnectivity ? 'success' : 'error'}>{diagnosticsOutput.ollamaConnectivity ? 'Online' : 'Offline'}</Tag></div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}><Text>LLM Model:</Text><Text strong>{diagnosticsOutput.configDetails?.activeModel || 'N/A'}</Text></div>
                  </Space>
                ) : (
                  <Alert message="Click 'Run Check' to verify AI and database connectivity." type="info" showIcon />
                )}
              </Card>
            </Col>
          </Row>
        </div>
      )}

      {/* ================= TAB: USERS & MENTORS ================= */}
      {activeTab === 'admin-users' && (
        <div className="portal-view">
          <Tabs defaultActiveKey="users" type="card" style={{ marginBottom: 0 }}>
            {/* Sub-tab: Users */}
            <TabPane tab={<><UsersIcon size={14} style={{ marginRight: 6, verticalAlign: 'text-bottom' }} />Users ({usersList.length})</>} key="users">
              <Card hoverable>
                <Space style={{ marginBottom: 16, width: '100%', justifyContent: 'space-between' }}>
                  <Space>
                    <Input.Search placeholder="Search email or name..." allowClear style={{ width: 260 }} value={userSearchQ} onChange={e => setUserSearchQ(e.target.value)} onSearch={loadUsers} />
                    <Select placeholder="Filter role" allowClear style={{ width: 150 }} value={userFilterRole || undefined} onChange={v => { setUserFilterRole(v || ''); }}>
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

            {/* Sub-tab: Mentors */}
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
                {adminImportLog && <Alert message="Import Result:" description={<pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{adminImportLog}</pre>} type="success" showIcon />}
              </Card>
            </TabPane>

            {/* Sub-tab: Support Requests */}
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
                <Select><Option value="STUDENT">Student</Option><Option value="TEACHER">Teacher</Option><Option value="ADMIN">Admin</Option></Select>
              </Form.Item>
              <Form.Item name="isActive" label="Status" valuePropName="checked">
                <Switch checkedChildren="Active" unCheckedChildren="Inactive" />
              </Form.Item>
              <Button type="primary" htmlType="submit" block>Save Changes</Button>
            </Form>
          </Modal>
        </div>
      )}

      {/* ================= TAB: TERMS & CLASSES ================= */}
      {activeTab === 'admin-academic' && (
        <div className="portal-view">
          <Tabs defaultActiveKey="semesters" type="card">
            {/* Sub-tab: Terms */}
            <TabPane tab="Terms" key="semesters">
              <Row gutter={[16, 16]}>
                <Col xs={24} md={10}>
                  <Card title="Create New Term" hoverable>
                    <Form form={formSemester} layout="vertical" onFinish={handleCreateSemester}>
                      <Form.Item name="semesterCode" label="Term Code" rules={[{ required: true, message: 'Enter a term code' }]}>
                        <Input placeholder="Example: SEM5, SUMMER2026" />
                      </Form.Item>
                      <Form.Item name="name" label="Term Name" rules={[{ required: true, message: 'Enter a term name' }]}>
                        <Input placeholder="Summer 2026" />
                      </Form.Item>
                      <Button type="primary" htmlType="submit" block icon={<Plus size={14} />}>Add Term</Button>
                    </Form>
                  </Card>
                </Col>
                <Col xs={24} md={14}>
                  <Card title="Term List" hoverable extra={<Button size="small" onClick={loadSemesters} icon={<RefreshCw size={14} />}>Reload</Button>}>
                    <Table dataSource={semesters} rowKey="id" size="small" pagination={false}
                      columns={[
                        { title: 'Code', dataIndex: 'semesterCode', key: 'code' },
                        { title: 'Name', dataIndex: 'name', key: 'name' },
                        { title: 'Status', dataIndex: 'status', key: 'status', render: v => <Tag color={v === 'ACTIVE' ? 'green' : 'default'}>{v}</Tag> }
                      ]}
                    />
                  </Card>
                </Col>
              </Row>
            </TabPane>

            {/* Sub-tab: Courses */}
            <TabPane tab="Courses" key="courses">
              <Row gutter={[16, 16]}>
                <Col xs={24} md={10}>
                  <Card title="Create New Course" hoverable>
                    <Form form={formCourse} layout="vertical" onFinish={handleCreateCourse}>
                      <Form.Item name="courseId" label="Course ID" rules={[{ required: true }]}>
                        <Input placeholder="PRJ301" />
                      </Form.Item>
                      <Form.Item name="courseName" label="Course Name" rules={[{ required: true }]}>
                        <Input placeholder="Java Web Application" />
                      </Form.Item>
                      <Form.Item name="credits" label="Credits" initialValue={3}>
                        <InputNumber min={1} max={10} style={{ width: '100%' }} />
                      </Form.Item>
                      <Button type="primary" htmlType="submit" block icon={<Plus size={14} />}>Add Course</Button>
                    </Form>
                  </Card>
                </Col>
                <Col xs={24} md={14}>
                  <Card title="Course List" hoverable extra={<Button size="small" onClick={loadCourses} icon={<RefreshCw size={14} />}>Reload</Button>}>
                    <Table dataSource={courses} rowKey="id" size="small" pagination={false}
                      columns={[
                        { title: 'Code', dataIndex: 'courseId', key: 'id' },
                        { title: 'Name', dataIndex: 'courseName', key: 'name' },
                        { title: 'Credits', dataIndex: 'credits', key: 'credits', width: 80 },
                        { title: 'Status', dataIndex: 'status', key: 'status', render: v => <Tag color={v === 'ACTIVE' ? 'green' : 'default'}>{v}</Tag> }
                      ]}
                    />
                  </Card>
                </Col>
              </Row>
            </TabPane>

            {/* Sub-tab: Class Sections */}
            <TabPane tab="Class Sections" key="classes">
              <Row gutter={[16, 16]}>
                <Col xs={24} md={10}>
                  <Card title="Create Class Section" hoverable>
                    <Form form={formClass} layout="vertical" onFinish={handleCreateClass}>
                      <Form.Item name="courseId" label="Course" rules={[{ required: true }]}>
                        <Select placeholder="Choose a course">
                          {courses.map(c => <Option key={c.courseId || c.id} value={c.courseId}>{c.courseId} - {c.courseName}</Option>)}
                        </Select>
                      </Form.Item>
                      <Form.Item name="classCode" label="Class Code" rules={[{ required: true }]}>
                        <Input placeholder="SE1840" />
                      </Form.Item>
                      <Form.Item name="teacherId" label="Mentor ID" rules={[{ required: true }]}>
                        <Input placeholder="mentor-1" />
                      </Form.Item>
                      <Button type="primary" htmlType="submit" block icon={<Plus size={14} />}>Create Class</Button>
                    </Form>
                  </Card>
                </Col>
                <Col xs={24} md={14}>
                  <Card title="View Classes by Course" hoverable>
                    <Select placeholder="Choose a course to view classes" style={{ width: '100%', marginBottom: 16 }}
                      onChange={(v) => { setSelectedCourseId(v); loadClassSections(v); }}>
                      {courses.map(c => <Option key={c.courseId || c.id} value={c.courseId}>{c.courseId} - {c.courseName}</Option>)}
                    </Select>
                    <Table dataSource={classSections} rowKey="id" size="small" loading={academicLoading} pagination={false}
                      columns={[
                        { title: 'Class Code', dataIndex: 'classId', key: 'classId' },
                        { title: 'Mentor', dataIndex: 'teacherId', key: 'teacher' },
                        { title: 'Status', dataIndex: 'status', key: 'status', render: v => <Tag color={v === 'ACTIVE' ? 'green' : 'default'}>{v || 'ACTIVE'}</Tag> }
                      ]}
                      locale={{ emptyText: selectedCourseId ? 'No classes yet' : 'Choose a course to view classes' }}
                    />
                  </Card>
                </Col>
              </Row>
            </TabPane>
          </Tabs>
        </div>
      )}

      {/* ================= TAB: PAYMENTS & PLANS ================= */}
      {activeTab === 'admin-billing' && (
        <div className="portal-view">
          <Tabs defaultActiveKey="plans" type="card">
            {/* Sub-tab: Plans */}
            <TabPane tab={<><CreditCard size={14} style={{ marginRight: 6, verticalAlign: 'text-bottom' }} />Plans ({(Array.isArray(adminPlans) ? adminPlans : []).length})</>} key="plans">
              <Card hoverable>
                <Table dataSource={Array.isArray(adminPlans) ? adminPlans : []} columns={planColumns} rowKey={r => r.id || r.code} pagination={false} size="middle" />
              </Card>
            </TabPane>

            {/* Sub-tab: Subscriptions */}
            <TabPane tab={<><Zap size={14} style={{ marginRight: 6, verticalAlign: 'text-bottom' }} />Subscriptions ({subscriptions.length})</>} key="subscriptions">
              <Card hoverable>
                <Space style={{ marginBottom: 16 }}>
                  <Button type="primary" icon={<Plus size={14} />} onClick={() => setAssignModal(true)}>Assign Plan to User</Button>
                  <Button onClick={loadSubscriptions} icon={<RefreshCw size={14} />}>Reload</Button>
                </Space>
                <Table dataSource={subscriptions} columns={subColumns} rowKey="id" loading={subsLoading} pagination={{ pageSize: 8 }} size="middle" locale={{ emptyText: 'No subscriptions yet' }} />
              </Card>
            </TabPane>
          </Tabs>

          {/* Assign subscription modal */}
          <Modal title="Assign Plan to User" open={assignModal} onCancel={() => setAssignModal(false)} footer={null} destroyOnClose>
            <Form form={formAssign} layout="vertical" onFinish={handleAssignSub}>
              <Form.Item name="userId" label="User ID" rules={[{ required: true }]}>
                <Input placeholder="student-a1" />
              </Form.Item>
              <Form.Item name="planCode" label="Plan" rules={[{ required: true }]}>
                <Select placeholder="Choose a plan">
                  {(Array.isArray(adminPlans) ? adminPlans : []).map(p => <Option key={p.code} value={p.code}>{p.name} ({(p.price || 0).toLocaleString('vi-VN')} VND)</Option>)}
                </Select>
              </Form.Item>
              <Button type="primary" htmlType="submit" block>Confirm Assignment</Button>
            </Form>
          </Modal>
        </div>
      )}
    </div>
  );
}

export default AdminPortal;
