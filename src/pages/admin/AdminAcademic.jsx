import React, { useState, useEffect } from 'react';
import { Alert, Row, Col, Card, Table, Button, Form, Input, InputNumber, Select, Tag, Space, Tabs, Upload } from 'antd';
import { DownloadOutlined, UploadOutlined } from '@ant-design/icons';
import { Database, RefreshCw, Plus, Search, Trash2 } from 'lucide-react';
import { apiService } from '../../services/api';
import { getUserFacingError } from '../../services/apiClient';

const { Option } = Select;
const { TabPane } = Tabs;
const { Dragger } = Upload;

function AdminAcademic({ triggerToast, currentUser }) {
  const [semesters, setSemesters] = useState([]);
  const [courses, setCourses] = useState([]);
  const [classSections, setClassSections] = useState([]);
  const [selectedCourseId, setSelectedCourseId] = useState('');
  const [academicLoading, setAcademicLoading] = useState(false);

  const [enrollmentSearchId, setEnrollmentSearchId] = useState('');
  const [studentEnrollments, setStudentEnrollments] = useState([]);
  const [enrollmentsLoading, setEnrollmentsLoading] = useState(false);
  const [materialCourseId, setMaterialCourseId] = useState('');
  const [courseMaterials, setCourseMaterials] = useState([]);
  const [materialsLoading, setMaterialsLoading] = useState(false);
  const [materialFile, setMaterialFile] = useState(null);
  const [studentImportCourseId, setStudentImportCourseId] = useState('');
  const [studentImportClassId, setStudentImportClassId] = useState('');
  const [studentImportClasses, setStudentImportClasses] = useState([]);
  const [studentImportFile, setStudentImportFile] = useState(null);
  const [studentImportLoading, setStudentImportLoading] = useState(false);
  const [studentImportResult, setStudentImportResult] = useState(null);

  const [formSemester] = Form.useForm();
  const [formCourse] = Form.useForm();
  const [formClass] = Form.useForm();
  const [formEnroll] = Form.useForm();
  const [formMaterial] = Form.useForm();
  const [formStudentImport] = Form.useForm();

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
  const loadCourseMaterials = async (courseId = materialCourseId) => {
    if (!courseId) {
      setCourseMaterials([]);
      return;
    }
    setMaterialsLoading(true);
    try {
      const data = await apiService.getCourseMaterials(courseId);
      setCourseMaterials(Array.isArray(data?.materials) ? data.materials : Array.isArray(data?.content) ? data.content : Array.isArray(data) ? data : []);
    } catch (error) {
      setCourseMaterials([]);
      triggerToast(getUserFacingError(error, 'Unable to load course materials.'));
    } finally {
      setMaterialsLoading(false);
    }
  };
  const loadStudentImportClasses = async (courseId) => {
    setStudentImportCourseId(courseId);
    setStudentImportClassId('');
    formStudentImport.setFieldsValue({ classId: undefined });
    setStudentImportResult(null);
    if (!courseId) {
      setStudentImportClasses([]);
      return;
    }
    try {
      const data = await apiService.getClassSections(courseId);
      setStudentImportClasses(Array.isArray(data) ? data : []);
    } catch (error) {
      setStudentImportClasses([]);
      triggerToast(getUserFacingError(error, 'Unable to load class sections.'));
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
  const handleUploadMaterial = async (values) => {
    if (!materialCourseId) {
      triggerToast('Please choose a course first.');
      return;
    }
    if (!materialFile) {
      triggerToast('Please choose a material file first.');
      return;
    }
    const formData = new FormData();
    formData.append('file', materialFile);
    formData.append('title', values.title);
    formData.append('teacherId', currentUser?.userId || currentUser?.id || 'ADMIN');
    formData.append('uploaderRole', 'ADMIN');
    try {
      await apiService.uploadMaterial(materialCourseId, formData);
      triggerToast('Course-wide material uploaded.');
      formMaterial.resetFields();
      setMaterialFile(null);
      loadCourseMaterials(materialCourseId);
    } catch (error) {
      triggerToast(getUserFacingError(error, 'Unable to upload course material.'));
    }
  };
  const handleDownloadMaterial = async (materialId, title) => {
    try {
      const blob = await apiService.downloadMaterialPdf(materialCourseId, materialId);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${title || 'material'}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      triggerToast(getUserFacingError(error, 'Unable to download course material.'));
    }
  };
  const handleReindexMaterial = async (materialId) => {
    try {
      await apiService.reindexMaterial(materialCourseId, materialId);
      triggerToast('Material reindexing triggered.');
    } catch (error) {
      triggerToast(getUserFacingError(error, 'Unable to reindex course material.'));
    }
  };
  const handleDeleteMaterial = async (materialId) => {
    if (!window.confirm('Delete this course material from the shared AI knowledge base?')) return;
    try {
      await apiService.deleteMaterial(materialCourseId, materialId);
      triggerToast('Course material deleted.');
      loadCourseMaterials(materialCourseId);
    } catch (error) {
      triggerToast(getUserFacingError(error, 'Unable to delete course material.'));
    }
  };
  const handleDownloadStudentTemplate = async () => {
    try {
      const blob = await apiService.downloadStudentImportTemplate();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'student-enrollment-template.xlsx';
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      triggerToast(getUserFacingError(error, 'Unable to download student import template.'));
    }
  };
  const handleStudentImport = async (dryRun) => {
    const values = await formStudentImport.validateFields();
    if (!studentImportFile) {
      triggerToast('Please choose an Excel file first.');
      return;
    }
    const selectedCourse = courses.find(c => c.courseId === values.courseId);
    const formData = new FormData();
    formData.append('file', studentImportFile);
    setStudentImportLoading(true);
    try {
      const result = await apiService.importClassStudents(values.courseId, values.classId, formData, {
        semesterId: values.semesterId,
        courseName: values.courseName || selectedCourse?.courseName,
        status: values.status || 'ACTIVE',
        dryRun,
      });
      setStudentImportResult(result);
      triggerToast(dryRun ? 'Student import validation finished.' : 'Students imported successfully.');
      if (!dryRun && enrollmentSearchId) loadStudentEnrollments();
    } catch (error) {
      setStudentImportResult(error?.details || null);
      triggerToast(getUserFacingError(error, 'Student import failed.'));
    } finally {
      setStudentImportLoading(false);
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

        {/* Student Import */}
        <TabPane tab="Import Students" key="student-import">
          <Row gutter={[16, 16]}>
            <Col xs={24} lg={9}>
              <Card
                title="Import Students from Excel"
                hoverable
                extra={<Button size="small" icon={<DownloadOutlined />} onClick={handleDownloadStudentTemplate}>Template</Button>}
              >
                <Alert
                  type="info"
                  showIcon
                  style={{ marginBottom: 16 }}
                  message="Import students into one class section using the generated Excel template."
                  description="Run Validate only first to catch file or duplicate student errors before writing data."
                />
                <Form form={formStudentImport} layout="vertical">
                  <Form.Item name="courseId" label="Course" rules={[{ required: true, message: 'Choose a course' }]}>
                    <Select placeholder="Choose a course" onChange={loadStudentImportClasses}>
                      {courses.map(c => <Option key={c.courseId || c.id} value={c.courseId}>{c.courseId} - {c.courseName}</Option>)}
                    </Select>
                  </Form.Item>
                  <Form.Item name="classId" label="Class Section" rules={[{ required: true, message: 'Choose a class section' }]}>
                    <Select
                      placeholder={studentImportCourseId ? 'Choose a class section' : 'Choose a course first'}
                      disabled={!studentImportCourseId}
                      onChange={setStudentImportClassId}
                    >
                      {studentImportClasses.map(cs => (
                        <Option key={cs.classId || cs.id} value={cs.classId}>{cs.classId}{cs.teacherId ? ` - ${cs.teacherId}` : ''}</Option>
                      ))}
                    </Select>
                  </Form.Item>
                  <Row gutter={12}>
                    <Col xs={24} md={12}>
                      <Form.Item name="semesterId" label="Term Code">
                        <Input placeholder="Optional, e.g. SEM5" />
                      </Form.Item>
                    </Col>
                    <Col xs={24} md={12}>
                      <Form.Item name="status" label="Status" initialValue="ACTIVE">
                        <Select>
                          <Option value="ACTIVE">Active</Option>
                          <Option value="COMPLETED">Completed</Option>
                          <Option value="INACTIVE">Inactive</Option>
                        </Select>
                      </Form.Item>
                    </Col>
                  </Row>
                  <Form.Item name="courseName" label="Course Name Override">
                    <Input placeholder="Optional. Uses selected course name by default." />
                  </Form.Item>
                  <Dragger
                    beforeUpload={(file) => {
                      const isExcel = /\.(xlsx|xls)$/i.test(file.name);
                      if (!isExcel) {
                        triggerToast('Only Excel files are supported (.xlsx or .xls).');
                        return Upload.LIST_IGNORE;
                      }
                      if (file.size > 5 * 1024 * 1024) {
                        triggerToast('File is too large. Maximum size is 5MB.');
                        return Upload.LIST_IGNORE;
                      }
                      setStudentImportFile(file);
                      setStudentImportResult(null);
                      return false;
                    }}
                    fileList={studentImportFile ? [studentImportFile] : []}
                    onRemove={() => {
                      setStudentImportFile(null);
                      setStudentImportResult(null);
                    }}
                    accept=".xlsx,.xls"
                    maxCount={1}
                    style={{ marginBottom: 16 }}
                  >
                    <p className="ant-upload-drag-icon"><UploadOutlined /></p>
                    <p className="ant-upload-text">Choose student enrollment Excel file</p>
                    <p className="ant-upload-hint">Template columns: Student ID, Student Name.</p>
                  </Dragger>
                  <Space style={{ width: '100%' }} direction="vertical">
                    <Button
                      block
                      onClick={() => handleStudentImport(true)}
                      disabled={!studentImportCourseId || !studentImportClassId || !studentImportFile}
                      loading={studentImportLoading}
                    >
                      Validate Only
                    </Button>
                    <Button
                      type="primary"
                      block
                      icon={<UploadOutlined />}
                      onClick={() => handleStudentImport(false)}
                      disabled={!studentImportCourseId || !studentImportClassId || !studentImportFile}
                      loading={studentImportLoading}
                    >
                      Import Students
                    </Button>
                  </Space>
                </Form>
              </Card>
            </Col>
            <Col xs={24} lg={15}>
              <Card title="Import Result" hoverable>
                {!studentImportResult ? (
                  <Alert
                    type="success"
                    showIcon
                    message="Ready to import"
                    description="Download the template, fill Student ID and Student Name, then validate the file before importing."
                  />
                ) : (
                  <Space direction="vertical" size={16} style={{ width: '100%' }}>
                    <Alert
                      type={studentImportResult.success === false ? 'error' : 'success'}
                      showIcon
                      message={studentImportResult.message || (studentImportResult.dryRun ? 'Validation completed.' : 'Import completed.')}
                      description={`Rows: ${studentImportResult.totalRows ?? 0} | Success: ${studentImportResult.successCount ?? 0} | Errors: ${studentImportResult.errorCount ?? 0}`}
                    />
                    <Row gutter={[16, 16]}>
                      <Col xs={24} md={12}>
                        <Card size="small" title="Success Messages">
                          <Table
                            dataSource={(studentImportResult.successMessages || []).map((text, index) => ({ id: `success-${index}`, text }))}
                            rowKey="id"
                            size="small"
                            pagination={{ pageSize: 5 }}
                            columns={[{ title: 'Message', dataIndex: 'text', key: 'text' }]}
                            locale={{ emptyText: 'No success messages.' }}
                          />
                        </Card>
                      </Col>
                      <Col xs={24} md={12}>
                        <Card size="small" title="Error Messages">
                          <Table
                            dataSource={(studentImportResult.errorMessages || []).map((text, index) => ({ id: `error-${index}`, text }))}
                            rowKey="id"
                            size="small"
                            pagination={{ pageSize: 5 }}
                            columns={[{ title: 'Message', dataIndex: 'text', key: 'text' }]}
                            locale={{ emptyText: 'No errors.' }}
                          />
                        </Card>
                      </Col>
                    </Row>
                  </Space>
                )}
              </Card>
            </Col>
          </Row>
        </TabPane>

        {/* Course Materials */}
        <TabPane tab="Course Materials" key="materials">
          <Row gutter={[16, 16]}>
            <Col xs={24} lg={9}>
              <Card title="Upload Shared Course Material" hoverable>
                <Alert
                  type="info"
                  showIcon
                  style={{ marginBottom: 16 }}
                  message="Course materials are managed by Admin because they are shared across classes."
                />
                <Form form={formMaterial} layout="vertical" onFinish={handleUploadMaterial}>
                  <Form.Item label="Course" required>
                    <Select
                      placeholder="Choose a course"
                      value={materialCourseId || undefined}
                      onChange={(value) => {
                        setMaterialCourseId(value);
                        loadCourseMaterials(value);
                      }}
                    >
                      {courses.map(c => <Option key={c.courseId || c.id} value={c.courseId}>{c.courseId} - {c.courseName}</Option>)}
                    </Select>
                  </Form.Item>
                  <Form.Item name="title" label="Material title" rules={[{ required: true, message: 'Enter a material title' }]}>
                    <Input placeholder="Lecture 01 - OOP" />
                  </Form.Item>
                  <Dragger
                    beforeUpload={(file) => {
                      setMaterialFile(file);
                      return false;
                    }}
                    fileList={materialFile ? [materialFile] : []}
                    onRemove={() => setMaterialFile(null)}
                    accept=".pdf,.doc,.docx,.ppt,.pptx,.txt"
                    maxCount={1}
                    style={{ marginBottom: 16 }}
                  >
                    <p className="ant-upload-drag-icon"><UploadOutlined /></p>
                    <p className="ant-upload-text">Choose a course material file</p>
                    <p className="ant-upload-hint">This upload is course-wide. Class ID is not sent.</p>
                  </Dragger>
                  <Button type="primary" htmlType="submit" block icon={<UploadOutlined />} disabled={!materialCourseId || !materialFile}>
                    Upload Course Material
                  </Button>
                </Form>
              </Card>
            </Col>
            <Col xs={24} lg={15}>
              <Card
                title="Shared Course Materials"
                hoverable
                extra={<Button size="small" onClick={() => loadCourseMaterials()} icon={<RefreshCw size={14} />} disabled={!materialCourseId}>Reload</Button>}
              >
                <Table
                  dataSource={courseMaterials}
                  rowKey="id"
                  size="small"
                  loading={materialsLoading}
                  pagination={{ pageSize: 8 }}
                  columns={[
                    { title: 'Title', dataIndex: 'title', key: 'title', render: (value) => value || 'Untitled Material' },
                    { title: 'File', dataIndex: 'fileName', key: 'fileName', render: (value, record) => <span style={{ fontFamily: 'monospace', fontSize: 12 }}>{value || record.filePath || record.id}</span> },
                    { title: 'Scope', dataIndex: 'classId', key: 'classId', render: (value) => <Tag>{value || 'Course-wide'}</Tag> },
                    { title: 'Uploaded', dataIndex: 'createdAt', key: 'createdAt', render: (value) => value ? new Date(value).toLocaleString('en-US') : '—' },
                    {
                      title: 'Actions',
                      key: 'actions',
                      width: 230,
                      render: (_, record) => (
                        <Space size="small" wrap>
                          <Button size="small" icon={<DownloadOutlined />} onClick={() => handleDownloadMaterial(record.id, record.title)}>Download</Button>
                          <Button size="small" icon={<Database size={13} />} onClick={() => handleReindexMaterial(record.id)}>Reindex</Button>
                          <Button size="small" danger icon={<Trash2 size={13} />} onClick={() => handleDeleteMaterial(record.id)}>Delete</Button>
                        </Space>
                      )
                    }
                  ]}
                  locale={{ emptyText: materialCourseId ? 'No course materials uploaded yet.' : 'Choose a course to load materials.' }}
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
