import React, { useState, useEffect } from 'react';
import { Alert, Row, Col, Card, Table, Button, Form, Input, InputNumber, Select, Tag, Space, Tabs, Upload, Modal } from 'antd';
import { DownloadOutlined, UploadOutlined } from '@ant-design/icons';
import { Database, RefreshCw, Plus, Search, Trash2, Eye, Pencil, UserMinus } from 'lucide-react';
import { apiService } from '../../services/api';
import { getUserFacingError } from '../../services/apiClient';
import { closeActiveConfirm, confirmDanger } from '../../components/common/confirmDialog';
import EntityActionMenu from '../../components/common/EntityActionMenu';

const { Option } = Select;
const { TabPane } = Tabs;
const { Dragger } = Upload;

const getRecordId = (record) => record?.id || record?._id || record?.materialId;
const getSemesterCode = (record) => record?.semesterCode || record?.code || record?.id;
const getCourseCode = (record) => record?.courseId || record?.id;
const getClassCode = (record) => record?.classId || record?.classCode || record?.id;
const getEnrollmentId = (record) => record?.id || record?._id || record?.enrollmentId;

const wait = (ms) => new Promise((resolve) => window.setTimeout(resolve, ms));

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
  const [materialUploadBusy, setMaterialUploadBusy] = useState(false);
  const [materialFile, setMaterialFile] = useState(null);
  const [studentImportCourseId, setStudentImportCourseId] = useState('');
  const [studentImportClassId, setStudentImportClassId] = useState('');
  const [studentImportClasses, setStudentImportClasses] = useState([]);
  const [studentImportFile, setStudentImportFile] = useState(null);
  const [studentImportLoading, setStudentImportLoading] = useState(false);
  const [studentImportResult, setStudentImportResult] = useState(null);
  const [entityModal, setEntityModal] = useState({ open: false, type: '', mode: 'view', record: null });
  const [entitySaving, setEntitySaving] = useState(false);

  const [formSemester] = Form.useForm();
  const [formCourse] = Form.useForm();
  const [formClass] = Form.useForm();
  const [formEnroll] = Form.useForm();
  const [formMaterial] = Form.useForm();
  const [formStudentImport] = Form.useForm();
  const [formEntity] = Form.useForm();

  useEffect(() => {
    loadSemesters();
    loadCourses();
    return () => closeActiveConfirm();
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
  const resolveStudentSearchId = async (rawValue) => {
    const value = String(rawValue || '').trim();
    if (!value) return '';
    const users = await apiService.getAdminUsers(value, 'STUDENT');
    const normalized = String(value).toLowerCase();
    const matchedUser = users.find((user) => {
      const candidates = [
        user.id,
        user._id,
        user.userId,
        user.studentId,
        user.studentCode,
        user.email,
        user.fullName,
        user.name,
      ].filter(Boolean).map((item) => String(item).toLowerCase());
      return candidates.includes(normalized);
    }) || users[0];
    return matchedUser?.userId || matchedUser?.id || matchedUser?._id || value;
  };

  const loadStudentEnrollments = async () => {
    const rawSearch = String(enrollmentSearchId || '').trim();
    if (!rawSearch) { triggerToast('Please enter a student ID, email, or student code.'); return; }
    setEnrollmentsLoading(true);
    try {
      let searchId = rawSearch;
      let data = await apiService.getStudentEnrollments(searchId);
      let items = Array.isArray(data) ? data : Array.isArray(data?.content) ? data.content : Array.isArray(data?.enrollments) ? data.enrollments : [];

      if (items.length === 0) {
        searchId = await resolveStudentSearchId(rawSearch);
        if (searchId && searchId !== rawSearch) {
          data = await apiService.getStudentEnrollments(searchId);
          items = Array.isArray(data) ? data : Array.isArray(data?.content) ? data.content : Array.isArray(data?.enrollments) ? data.enrollments : [];
        }
      }

      setStudentEnrollments(items);
      if (items.length === 0) {
        triggerToast('No enrollment records found for this student.');
      }
    } catch (error) {
      setStudentEnrollments([]);
      triggerToast(getUserFacingError(error, 'Failed to load student enrollments.'));
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
  const refreshCourseMaterialsWithRetry = async (courseId, previousCount = 0, expectedTitle = '') => {
    const delays = [0, 1200, 2500, 4500, 7000, 10000];
    const normalizedTitle = String(expectedTitle || '').trim().toLowerCase();
    setMaterialsLoading(true);
    try {
      for (const delay of delays) {
        if (delay) await wait(delay);
        try {
          const data = await apiService.getCourseMaterials(courseId);
          const items = Array.isArray(data?.materials) ? data.materials : Array.isArray(data?.content) ? data.content : Array.isArray(data) ? data : [];
          setCourseMaterials(items);
          const hasExpectedTitle = normalizedTitle && items.some((item) => String(item?.title || '').trim().toLowerCase() === normalizedTitle);
          if (items.length > previousCount || hasExpectedTitle) return true;
        } catch (error) {
          if (delay === delays[delays.length - 1]) {
            triggerToast(getUserFacingError(error, 'Unable to refresh course materials.'));
          }
        }
      }
      return false;
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

  const openEntityModal = (type, mode, record) => {
    const nextRecord = record || {};
    setEntityModal({ open: true, type, mode, record: nextRecord });
    if (type === 'semester') {
      formEntity.setFieldsValue({
        semesterCode: getSemesterCode(nextRecord),
        name: nextRecord.name,
        status: nextRecord.status || 'ACTIVE',
      });
    }
    if (type === 'course') {
      formEntity.setFieldsValue({
        courseId: getCourseCode(nextRecord),
        courseName: nextRecord.courseName || nextRecord.name,
        credits: nextRecord.credits || 3,
        status: nextRecord.status || 'ACTIVE',
      });
    }
    if (type === 'class') {
      formEntity.setFieldsValue({
        courseId: nextRecord.courseId || selectedCourseId,
        classId: getClassCode(nextRecord),
        teacherId: nextRecord.teacherId,
        status: nextRecord.status || 'ACTIVE',
      });
    }
    if (type === 'enrollment') {
      formEntity.setFieldsValue({
        studentId: nextRecord.studentId || nextRecord.userId,
        courseId: nextRecord.courseId,
        classId: nextRecord.classId,
        status: nextRecord.status || 'ACTIVE',
      });
    }
    if (type === 'material') {
      formEntity.setFieldsValue({
        title: nextRecord.title || 'Untitled Material',
        category: nextRecord.category || nextRecord.materialCategory || '',
      });
    }
  };

  const closeEntityModal = () => {
    setEntityModal({ open: false, type: '', mode: 'view', record: null });
    formEntity.resetFields();
  };

  const handleEntitySave = async () => {
    if (entityModal.mode === 'view') {
      closeEntityModal();
      return;
    }
    const values = await formEntity.validateFields();
    const record = entityModal.record || {};
    setEntitySaving(true);
    try {
      if (entityModal.type === 'semester') {
        const semesterCode = getSemesterCode(record);
        await apiService.updateSemester(semesterCode, {
          ...record,
          semesterCode,
          name: values.name,
          status: values.status,
        });
        triggerToast('Term updated.');
        await loadSemesters();
      }
      if (entityModal.type === 'course') {
        const courseId = getCourseCode(record);
        await apiService.updateCourse(courseId, {
          ...record,
          courseId,
          courseName: values.courseName,
          credits: values.credits,
          status: values.status,
        });
        triggerToast('Course updated.');
        await loadCourses();
      }
      if (entityModal.type === 'class') {
        const courseId = record.courseId || selectedCourseId || values.courseId;
        const classId = getClassCode(record);
        await apiService.updateClassSection(courseId, classId, {
          ...record,
          courseId,
          classId,
          teacherId: values.teacherId,
          status: values.status,
        });
        triggerToast('Class section updated.');
        await loadClassSections(courseId);
      }
      if (entityModal.type === 'enrollment') {
        const enrollmentId = getEnrollmentId(record);
        await apiService.updateEnrollment(enrollmentId, {
          ...record,
          studentId: values.studentId,
          courseId: values.courseId,
          classId: values.classId,
          status: values.status,
        });
        triggerToast('Enrollment updated.');
        await loadStudentEnrollments();
      }
      if (entityModal.type === 'material') {
        const materialId = getRecordId(record);
        const courseId = record.courseId || materialCourseId;
        await apiService.updateMaterialMetadata(courseId, materialId, {
          ...record,
          title: values.title,
          category: values.category,
        });
        triggerToast('Material metadata updated.');
        await loadCourseMaterials(courseId);
      }
      closeEntityModal();
    } catch (error) {
      triggerToast(getUserFacingError(error, 'Unable to save changes.'));
    } finally {
      setEntitySaving(false);
    }
  };

  const handleDeleteSemester = (record, anchorRect) => {
    const semesterCode = getSemesterCode(record);
    if (!semesterCode) return triggerToast('This term is missing a code.');
    confirmDanger({
      title: 'Delete term?',
      content: `This removes term ${semesterCode}.`,
      anchorRect,
      onOk: async () => {
        try {
          await apiService.deleteSemester(semesterCode);
          triggerToast('Term deleted.');
          await loadSemesters();
        } catch (error) {
          triggerToast(getUserFacingError(error, 'Unable to delete term.'));
        }
      },
    });
  };

  const handleDeleteCourse = (record, anchorRect) => {
    const courseId = getCourseCode(record);
    if (!courseId) return triggerToast('This course is missing an ID.');
    confirmDanger({
      title: 'Delete course?',
      content: `This removes course ${courseId} and may affect class sections/enrollments.`,
      anchorRect,
      onOk: async () => {
        try {
          await apiService.deleteCourse(courseId);
          triggerToast('Course deleted.');
          await loadCourses();
          if (selectedCourseId === courseId) {
            setSelectedCourseId('');
            setClassSections([]);
          }
        } catch (error) {
          triggerToast(getUserFacingError(error, 'Unable to delete course.'));
        }
      },
    });
  };

  const handleDeleteClassSection = (record, anchorRect) => {
    const courseId = record.courseId || selectedCourseId;
    const classId = getClassCode(record);
    if (!courseId || !classId) return triggerToast('This class section is missing course or class ID.');
    confirmDanger({
      title: 'Delete class section?',
      content: `This removes ${courseId}/${classId}.`,
      anchorRect,
      onOk: async () => {
        try {
          await apiService.deleteClassSection(courseId, classId);
          triggerToast('Class section deleted.');
          await loadClassSections(courseId);
        } catch (error) {
          triggerToast(getUserFacingError(error, 'Unable to delete class section.'));
        }
      },
    });
  };

  const handleDeleteEnrollment = (record, anchorRect) => {
    const enrollmentId = getEnrollmentId(record);
    const courseId = record.courseId;
    const classId = record.classId;
    const studentId = record.studentId || record.userId;
    if (!enrollmentId && (!courseId || !classId || !studentId)) {
      return triggerToast('This enrollment is missing enough IDs to remove.');
    }
    confirmDanger({
      title: 'Remove enrollment?',
      content: 'This removes the student from the selected class section.',
      okText: 'Remove',
      anchorRect,
      onOk: async () => {
        try {
          if (enrollmentId) {
            await apiService.deleteEnrollment(enrollmentId);
          } else {
            await apiService.removeStudentFromClass(courseId, classId, studentId);
          }
          triggerToast('Enrollment removed.');
          await loadStudentEnrollments();
        } catch (error) {
          triggerToast(getUserFacingError(error, 'Unable to remove enrollment.'));
        }
      },
    });
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
    if (materialUploadBusy) return;
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
    setMaterialUploadBusy(true);
    const releaseUploadButton = () => window.setTimeout(() => setMaterialUploadBusy(false), 2500);
    const previousCount = courseMaterials.length;
    try {
      await apiService.uploadMaterial(materialCourseId, formData);
      const appeared = await refreshCourseMaterialsWithRetry(materialCourseId, previousCount, values.title);
      formMaterial.resetFields();
      setMaterialFile(null);
      triggerToast(appeared ? 'Course-wide material uploaded.' : 'Upload accepted. Material may appear after indexing finishes.');
    } catch (error) {
      triggerToast('Upload is processing. Checking material list...');
      const appeared = await refreshCourseMaterialsWithRetry(materialCourseId, previousCount, values.title);
      if (appeared) {
        formMaterial.resetFields();
        setMaterialFile(null);
        triggerToast('Course-wide material uploaded.');
      } else {
        triggerToast(getUserFacingError(error, 'Unable to upload course material. Please try again.'));
      }
    } finally {
      releaseUploadButton();
    }
  };
  const handleDownloadMaterial = async (materialId, title) => {
    if (!materialId) {
      triggerToast('This material is missing an ID. Please reload materials and try again.');
      return;
    }
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
    if (!materialId) {
      triggerToast('This material is missing an ID. Please reload materials and try again.');
      return;
    }
    try {
      await apiService.reindexMaterial(materialCourseId, materialId);
      triggerToast('Material reindexing triggered.');
    } catch (error) {
      triggerToast(getUserFacingError(error, 'Unable to reindex course material.'));
    }
  };
  const handleDeleteMaterial = async (materialId, anchorRect) => {
    if (!materialId) {
      triggerToast('This material is missing an ID. Please reload materials and try again.');
      return;
    }
    confirmDanger({
      title: 'Delete course material?',
      content: 'This removes the shared material from the course AI knowledge base.',
      okText: 'Delete',
      anchorRect,
      onOk: async () => {
        try {
          await apiService.deleteMaterial(materialCourseId, materialId);
          triggerToast('Course material deleted.');
          loadCourseMaterials(materialCourseId);
        } catch (error) {
          triggerToast(getUserFacingError(error, 'Unable to delete course material.'));
        }
      },
    });
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

  const baseActionItems = [
    { key: 'view', icon: <Eye size={14} />, label: 'View details' },
    { key: 'edit', icon: <Pencil size={14} />, label: 'Edit' },
    { type: 'divider' },
    { key: 'delete', icon: <Trash2 size={14} />, label: 'Delete', danger: true },
  ];

  const handleAcademicAction = (type, record, key, meta) => {
    if (key === 'view' || key === 'edit') {
      openEntityModal(type, key, record);
      return;
    }
    if (type === 'semester' && key === 'delete') handleDeleteSemester(record, meta?.anchorRect);
    if (type === 'course' && key === 'delete') handleDeleteCourse(record, meta?.anchorRect);
    if (type === 'class' && key === 'delete') handleDeleteClassSection(record, meta?.anchorRect);
    if (type === 'enrollment' && (key === 'delete' || key === 'remove')) handleDeleteEnrollment(record, meta?.anchorRect);
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
                    { title: 'Status', dataIndex: 'status', key: 'status', render: v => <Tag color={v === 'ACTIVE' ? 'green' : 'default'}>{v}</Tag> },
                    {
                      title: '',
                      key: 'actions',
                      width: 54,
                      align: 'center',
                      render: (_, record) => (
                        <EntityActionMenu
                          items={baseActionItems}
                          onAction={(key, meta) => handleAcademicAction('semester', record, key, meta)}
                          ariaLabel="Term actions"
                        />
                      ),
                    },
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
                    { title: 'Status', dataIndex: 'status', key: 'status', render: v => <Tag color={v === 'ACTIVE' ? 'green' : 'default'}>{v}</Tag> },
                    {
                      title: '',
                      key: 'actions',
                      width: 54,
                      align: 'center',
                      render: (_, record) => (
                        <EntityActionMenu
                          items={baseActionItems}
                          onAction={(key, meta) => handleAcademicAction('course', record, key, meta)}
                          ariaLabel="Course actions"
                        />
                      ),
                    },
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
                    { title: 'Status', dataIndex: 'status', key: 'status', render: v => <Tag color={v === 'ACTIVE' ? 'green' : 'default'}>{v || 'ACTIVE'}</Tag> },
                    {
                      title: '',
                      key: 'actions',
                      width: 54,
                      align: 'center',
                      render: (_, record) => (
                        <EntityActionMenu
                          items={baseActionItems}
                          onAction={(key, meta) => handleAcademicAction('class', record, key, meta)}
                          ariaLabel="Class section actions"
                        />
                      ),
                    },
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
                    placeholder="Enter user ID, email, or student code"
                    value={enrollmentSearchId}
                    onChange={(e) => setEnrollmentSearchId(e.target.value)}
                    onPressEnter={loadStudentEnrollments}
                    allowClear
                  />
                    <Button
                    type="primary"
                    icon={<Search size={14} />}
                    onClick={loadStudentEnrollments}
                    loading={enrollmentsLoading}
                    disabled={!enrollmentSearchId.trim() || enrollmentsLoading}
                  >
                    Search
                  </Button>
                </div>
                <Table
                  dataSource={studentEnrollments}
                  rowKey={(record) => record.id || record._id || `${record.studentId}-${record.courseId}-${record.classId}`}
                  size="small"
                  loading={enrollmentsLoading}
                  pagination={false}
                  columns={[
                    { title: 'Enrollment ID', dataIndex: 'id', key: 'id' },
                    { title: 'Course Code', dataIndex: 'courseId', key: 'course' },
                    { title: 'Class Code', dataIndex: 'classId', key: 'class' },
                    { title: 'Status', dataIndex: 'status', key: 'status', render: v => <Tag color={v === 'ACTIVE' ? 'green' : 'default'}>{v || 'ACTIVE'}</Tag> },
                    {
                      title: '',
                      key: 'actions',
                      width: 54,
                      align: 'center',
                      render: (_, record) => (
                        <EntityActionMenu
                          items={[
                            { key: 'view', icon: <Eye size={14} />, label: 'View details' },
                            { key: 'edit', icon: <Pencil size={14} />, label: 'Edit' },
                            { type: 'divider' },
                            { key: 'remove', icon: <UserMinus size={14} />, label: 'Remove from class', danger: true },
                          ]}
                          onAction={(key, meta) => handleAcademicAction('enrollment', record, key, meta)}
                          ariaLabel="Enrollment actions"
                        />
                      ),
                    },
                  ]}
                  locale={{ emptyText: 'No enrollment records loaded. Enter a user ID, email, or student code and click Search.' }}
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
                  <Button
                    type="primary"
                    htmlType="submit"
                    block
                    icon={<UploadOutlined />}
                    loading={materialUploadBusy}
                    disabled={!materialCourseId || !materialFile || materialUploadBusy}
                  >
                    {materialUploadBusy ? 'Uploading...' : 'Upload Course Material'}
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
                  rowKey={(record) => getRecordId(record) || `${record.courseId}-${record.title}-${record.createdAt}`}
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
                      width: 86,
                      align: 'center',
                      render: (_, record) => {
                        const materialId = getRecordId(record);
                        return (
                          <EntityActionMenu
                            items={[
                              { key: 'view', icon: <Eye size={14} />, label: 'View details' },
                              { key: 'edit', icon: <Pencil size={14} />, label: 'Edit metadata' },
                              { key: 'download', icon: <DownloadOutlined />, label: 'Download' },
                              { key: 'reindex', icon: <Database size={14} />, label: 'Reindex' },
                              { type: 'divider' },
                              { key: 'delete', icon: <Trash2 size={14} />, label: 'Delete', danger: true },
                            ]}
                            onAction={(key, meta) => {
                              if (key === 'view' || key === 'edit') openEntityModal('material', key, record);
                              if (key === 'download') handleDownloadMaterial(materialId, record.title);
                              if (key === 'reindex') handleReindexMaterial(materialId);
                              if (key === 'delete') handleDeleteMaterial(materialId, meta?.anchorRect);
                            }}
                            ariaLabel="Material actions"
                          />
                        );
                      }
                    }
                  ]}
                  locale={{ emptyText: materialCourseId ? 'No course materials uploaded yet.' : 'Choose a course to load materials.' }}
                />
              </Card>
            </Col>
          </Row>
        </TabPane>
      </Tabs>
      <Modal
        open={entityModal.open}
        title={`${entityModal.mode === 'view' ? 'View' : 'Edit'} ${({
          semester: 'Term',
          course: 'Course',
          class: 'Class Section',
          enrollment: 'Enrollment',
          material: 'Course Material',
        })[entityModal.type] || 'Record'}`}
        onCancel={closeEntityModal}
        onOk={handleEntitySave}
        okText={entityModal.mode === 'view' ? 'Close' : 'Save changes'}
        cancelButtonProps={{ style: entityModal.mode === 'view' ? { display: 'none' } : undefined }}
        confirmLoading={entitySaving}
        destroyOnClose
      >
        <Form form={formEntity} layout="vertical" disabled={entityModal.mode === 'view'}>
          {entityModal.type === 'semester' && (
            <>
              <Form.Item name="semesterCode" label="Term Code">
                <Input disabled />
              </Form.Item>
              <Form.Item name="name" label="Term Name" rules={[{ required: entityModal.mode === 'edit', message: 'Enter a term name' }]}>
                <Input />
              </Form.Item>
              <Form.Item name="status" label="Status">
                <Select>
                  <Option value="ACTIVE">Active</Option>
                  <Option value="INACTIVE">Inactive</Option>
                  <Option value="COMPLETED">Completed</Option>
                </Select>
              </Form.Item>
            </>
          )}

          {entityModal.type === 'course' && (
            <>
              <Form.Item name="courseId" label="Course ID">
                <Input disabled />
              </Form.Item>
              <Form.Item name="courseName" label="Course Name" rules={[{ required: entityModal.mode === 'edit', message: 'Enter a course name' }]}>
                <Input />
              </Form.Item>
              <Form.Item name="credits" label="Credits">
                <InputNumber min={1} max={10} style={{ width: '100%' }} />
              </Form.Item>
              <Form.Item name="status" label="Status">
                <Select>
                  <Option value="ACTIVE">Active</Option>
                  <Option value="INACTIVE">Inactive</Option>
                  <Option value="ARCHIVED">Archived</Option>
                </Select>
              </Form.Item>
            </>
          )}

          {entityModal.type === 'class' && (
            <>
              <Form.Item name="courseId" label="Course ID">
                <Input disabled />
              </Form.Item>
              <Form.Item name="classId" label="Class ID">
                <Input disabled />
              </Form.Item>
              <Form.Item name="teacherId" label="Mentor ID" rules={[{ required: entityModal.mode === 'edit', message: 'Enter mentor ID' }]}>
                <Input />
              </Form.Item>
              <Form.Item name="status" label="Status">
                <Select>
                  <Option value="ACTIVE">Active</Option>
                  <Option value="INACTIVE">Inactive</Option>
                  <Option value="COMPLETED">Completed</Option>
                </Select>
              </Form.Item>
            </>
          )}

          {entityModal.type === 'enrollment' && (
            <>
              <Form.Item name="studentId" label="Student ID">
                <Input disabled />
              </Form.Item>
              <Form.Item name="courseId" label="Course ID">
                <Input disabled />
              </Form.Item>
              <Form.Item name="classId" label="Class ID">
                <Input disabled />
              </Form.Item>
              <Form.Item name="status" label="Status">
                <Select>
                  <Option value="ACTIVE">Active</Option>
                  <Option value="INACTIVE">Inactive</Option>
                  <Option value="COMPLETED">Completed</Option>
                </Select>
              </Form.Item>
            </>
          )}

          {entityModal.type === 'material' && (
            <>
              <Form.Item label="Material ID">
                <Input value={getRecordId(entityModal.record)} disabled />
              </Form.Item>
              <Form.Item name="title" label="Title" rules={[{ required: entityModal.mode === 'edit', message: 'Enter material title' }]}>
                <Input />
              </Form.Item>
              <Form.Item name="category" label="Category">
                <Input placeholder="Optional category" />
              </Form.Item>
            </>
          )}
        </Form>
      </Modal>
    </div>
  );
}

export default AdminAcademic;
