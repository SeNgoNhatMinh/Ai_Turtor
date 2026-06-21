import React, { useState, useEffect } from 'react';
import { Row, Col, Card, Table, Button, Form, Input, InputNumber, Select, Tag, Space, Tabs } from 'antd';
import { RefreshCw, Plus, Search } from 'lucide-react';
import { apiService } from '../../services/api';

const { Option } = Select;
const { TabPane } = Tabs;

function AdminAcademic({ triggerToast }) {
  const [semesters, setSemesters] = useState([]);
  const [courses, setCourses] = useState([]);
  const [classSections, setClassSections] = useState([]);
  const [selectedCourseId, setSelectedCourseId] = useState('');
  const [academicLoading, setAcademicLoading] = useState(false);

  const [enrollmentSearchId, setEnrollmentSearchId] = useState('');
  const [studentEnrollments, setStudentEnrollments] = useState([]);
  const [enrollmentsLoading, setEnrollmentsLoading] = useState(false);

  const [formSemester] = Form.useForm();
  const [formCourse] = Form.useForm();
  const [formClass] = Form.useForm();
  const [formEnroll] = Form.useForm();

  useEffect(() => {
    loadSemesters();
    loadCourses();
  }, []);

  // ── Loaders ──────────────────────────────────────────────
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
  const loadStudentEnrollments = async () => {
    if (!enrollmentSearchId) { triggerToast('Please enter a student ID.'); return; }
    setEnrollmentsLoading(true);
    try {
      const data = await apiService.getStudentEnrollments(enrollmentSearchId);
      setStudentEnrollments(Array.isArray(data) ? data : []);
    } catch {
      setStudentEnrollments([]);
      triggerToast('Failed to load student enrollments.');
    } finally {
      setEnrollmentsLoading(false);
    }
  };

  // ── Handlers ─────────────────────────────────────────────
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
  const handleCreateEnrollment = async (values) => {
    try {
      await apiService.createEnrollment({ studentId: values.studentId, courseId: values.courseId, classId: values.classId, status: 'ACTIVE' });
      triggerToast('Student enrolled successfully.');
      formEnroll.resetFields();
      if (enrollmentSearchId === values.studentId) loadStudentEnrollments();
    } catch {
      triggerToast('Failed to enroll student.');
    }
  };

  // ── Render ───────────────────────────────────────────────
  return (
    <div className="portal-view">
      <Tabs defaultActiveKey="semesters" type="card">

        {/* Terms */}
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

        {/* Courses */}
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

        {/* Class Sections */}
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

        {/* Student Enrollments */}
        <TabPane tab="Student Enrollments" key="enrollments">
          <Row gutter={[16, 16]}>
            <Col xs={24} md={10}>
              <Card title="Enroll Student in Class" hoverable>
                <Form form={formEnroll} layout="vertical" onFinish={handleCreateEnrollment}>
                  <Form.Item name="studentId" label="Student ID" rules={[{ required: true, message: 'Enter student ID' }]}>
                    <Input placeholder="Example: student-a1" />
                  </Form.Item>
                  <Form.Item name="courseId" label="Course" rules={[{ required: true }]}>
                    <Select placeholder="Choose a course" onChange={(v) => { setSelectedCourseId(v); loadClassSections(v); }}>
                      {courses.map(c => <Option key={c.courseId || c.id} value={c.courseId}>{c.courseId} - {c.courseName}</Option>)}
                    </Select>
                  </Form.Item>
                  <Form.Item name="classId" label="Class Section" rules={[{ required: true }]}>
                    <Select placeholder="Choose a class section">
                      {classSections.map(cs => <Option key={cs.classId || cs.id} value={cs.classId}>{cs.classId}</Option>)}
                    </Select>
                  </Form.Item>
                  <Button type="primary" htmlType="submit" block icon={<Plus size={14} />}>Enroll Student</Button>
                </Form>
              </Card>
            </Col>
            <Col xs={24} md={14}>
              <Card title="Student Enrollments Search" hoverable>
                <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                  <Input
                    placeholder="Enter Student ID (e.g. student-a1)"
                    value={enrollmentSearchId}
                    onChange={(e) => setEnrollmentSearchId(e.target.value)}
                    onPressEnter={loadStudentEnrollments}
                  />
                  <Button type="primary" icon={<Search size={14} />} onClick={loadStudentEnrollments}>Search</Button>
                </div>
                <Table
                  dataSource={studentEnrollments}
                  rowKey="id"
                  size="small"
                  loading={enrollmentsLoading}
                  pagination={false}
                  columns={[
                    { title: 'Enrollment ID', dataIndex: 'id', key: 'id' },
                    { title: 'Course Code', dataIndex: 'courseId', key: 'course' },
                    { title: 'Class Code', dataIndex: 'classId', key: 'class' },
                    { title: 'Status', dataIndex: 'status', key: 'status', render: v => <Tag color={v === 'ACTIVE' ? 'green' : 'default'}>{v || 'ACTIVE'}</Tag> }
                  ]}
                  locale={{ emptyText: 'No enrollment records loaded. Enter a Student ID and click Search.' }}
                />
              </Card>
            </Col>
          </Row>
        </TabPane>
      </Tabs>
    </div>
  );
}

export default AdminAcademic;
