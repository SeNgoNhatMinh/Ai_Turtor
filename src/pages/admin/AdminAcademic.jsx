import { Suspense, lazy, useState, useEffect } from 'react';
import { Form, Tabs } from 'antd';
import { adminAcademicApi } from '../../services/adminAcademicApi';
import { adminUsersApi } from '../../services/adminUsersApi';
import { getUserFacingError } from '../../services/apiClient';
import { materialsApi } from '../../services/materialsApi';
import { closeActiveConfirm, confirmAction } from '../../components/common/confirmDialog';
import ClassSectionsTab from './academic/ClassSectionsTab';
import CourseMaterialsTab from './academic/CourseMaterialsTab';
import CoursesTab from './academic/CoursesTab';
import EntityRecordModal from './academic/EntityRecordModal';
import StudentEnrollmentsTab from './academic/StudentEnrollmentsTab';
import StudentImportTab from './academic/StudentImportTab';
import TermsTab from './academic/TermsTab';
import { useAcademicRecords } from './academic/hooks/useAcademicRecords';
import { useCourseMaterials } from './academic/hooks/useCourseMaterials';
import { useStudentImport } from './academic/hooks/useStudentImport';
import {
  getClassCode,
  getCourseCode,
  getEnrollmentId,
  getRecordId,
  getSemesterCode,
} from './academic/adminAcademicUtils';

const ImportWebsiteModal = lazy(() => import('../../components/importWebsite/ImportWebsiteModal'));

const { TabPane } = Tabs;

function AdminAcademic({ triggerToast, currentUser }) {
  const [entityModal, setEntityModal] = useState({ open: false, type: '', mode: 'view', record: null });
  const [entitySaving, setEntitySaving] = useState(false);
  const [mentorOptions, setMentorOptions] = useState([]);

  const [formSemester] = Form.useForm();
  const [formCourse] = Form.useForm();
  const [formClass] = Form.useForm();
  const [formEnroll] = Form.useForm();
  const [formMaterial] = Form.useForm();
  const [formStudentImport] = Form.useForm();
  const [formEntity] = Form.useForm();

  const {
    semesters,
    courses,
    classSections,
    selectedCourseId,
    academicLoading,
    enrollmentSearchId,
    studentEnrollments,
    enrollmentsLoading,
    setEnrollmentSearchId,
    loadSemesters,
    loadCourses,
    loadClassSections,
    loadStudentEnrollments,
    handleCourseSelect,
    handleCreateSemester,
    handleCreateCourse,
    handleCreateClass,
    handleCreateEnrollment,
    handleDeleteSemester,
    handleDeleteCourse,
    handleDeleteClassSection,
    handleDeleteEnrollment,
  } = useAcademicRecords({
    triggerToast,
    formSemester,
    formCourse,
    formClass,
    formEnroll,
  });

  useEffect(() => {
    loadSemesters();
    loadCourses();
    const loadMentorOptions = async () => {
      try {
        const mentors = await adminUsersApi.getMentors();
        setMentorOptions(Array.isArray(mentors) ? mentors : []);
      } catch {
        try {
          const mentors = await adminUsersApi.getAdminMentors();
          setMentorOptions(Array.isArray(mentors) ? mentors.filter((mentor) => mentor.isActive !== false) : []);
        } catch {
          setMentorOptions([]);
        }
      }
    };
    loadMentorOptions();
    return () => closeActiveConfirm();
    // Reference data is loaded once when the admin workspace mounts.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const {
    materialCourseId,
    courseMaterials,
    materialsLoading,
    materialUploadBusy,
    materialFile,
    websiteImportOpen,
    setMaterialFile,
    setWebsiteImportOpen,
    loadCourseMaterials,
    handleCourseChange: handleMaterialCourseChange,
    handleUploadMaterial,
    handleWebsiteMaterialImported,
    handleDownloadMaterial,
    handleReindexMaterial,
    handleDeleteMaterial,
  } = useCourseMaterials({ triggerToast, currentUser, formMaterial });

  const {
    studentImportCourseId,
    studentImportClassId,
    studentImportClasses,
    studentImportFile,
    studentImportLoading,
    studentImportResult,
    setStudentImportClassId,
    loadStudentImportClasses,
    handleDownloadStudentTemplate,
    handleStudentImport,
    handleFileChange: handleStudentImportFileChange,
    handleFileRemove: handleStudentImportFileRemove,
  } = useStudentImport({
    triggerToast,
    courses,
    formStudentImport,
    enrollmentSearchId,
    loadStudentEnrollments,
  });

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
        teacherName: nextRecord.teacherName || nextRecord.mentorName,
        teacherEmail: nextRecord.teacherEmail || nextRecord.mentorEmail,
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
        await adminAcademicApi.updateSemester(semesterCode, {
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
        await adminAcademicApi.updateCourse(courseId, {
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
        await adminAcademicApi.updateClassSection(courseId, classId, {
          ...record,
          courseId,
          classId,
          teacherId: values.teacherId,
          teacherName: values.teacherName,
          teacherEmail: values.teacherEmail,
          status: values.status,
        });
        triggerToast('Class section updated.');
        await loadClassSections(courseId);
      }
      if (entityModal.type === 'enrollment') {
        const enrollmentId = getEnrollmentId(record);
        await adminAcademicApi.updateEnrollment(enrollmentId, {
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
        await materialsApi.updateMaterialMetadata(courseId, materialId, {
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

  const handleCompleteCourse = (record, anchorRect) => {
    const courseId = getCourseCode(record);
    if (!courseId) {
      triggerToast('This course is missing an ID. Please reload and try again.');
      return;
    }
    confirmAction({
      title: 'Mark course complete?',
      content: 'This marks the course, its classes, and enrollments as completed for routing and reporting.',
      okText: 'Mark complete',
      anchorRect,
      onOk: async () => {
        try {
          await adminAcademicApi.completeCourse(courseId);
          triggerToast('Course marked complete.');
          await loadCourses();
          if (selectedCourseId === courseId) {
            await loadClassSections(courseId);
          }
        } catch (error) {
          triggerToast(getUserFacingError(error, 'Unable to mark course complete.'));
        }
      },
    });
  };

  const handleCompleteClassSection = (record, anchorRect) => {
    const courseId = record?.courseId || selectedCourseId;
    const classId = getClassCode(record);
    if (!courseId || !classId) {
      triggerToast('This class section is missing course/class ID. Please reload and try again.');
      return;
    }
    confirmAction({
      title: 'Mark class complete?',
      content: 'This marks the class section and its enrollments as completed.',
      okText: 'Mark complete',
      anchorRect,
      onOk: async () => {
        try {
          await adminAcademicApi.completeClassSection(courseId, classId);
          triggerToast('Class section marked complete.');
          await loadClassSections(courseId);
        } catch (error) {
          triggerToast(getUserFacingError(error, 'Unable to mark class complete.'));
        }
      },
    });
  };

  const handleAcademicAction = (type, record, key, meta) => {
    if (key === 'view' || key === 'edit') {
      openEntityModal(type, key, record);
      return;
    }
    if (type === 'course' && key === 'complete') handleCompleteCourse(record, meta?.anchorRect);
    if (type === 'class' && key === 'complete') handleCompleteClassSection(record, meta?.anchorRect);
    if (type === 'semester' && key === 'delete') handleDeleteSemester(record, meta?.anchorRect);
    if (type === 'course' && key === 'delete') handleDeleteCourse(record, meta?.anchorRect);
    if (type === 'class' && key === 'delete') handleDeleteClassSection(record, meta?.anchorRect);
    if (type === 'enrollment' && (key === 'delete' || key === 'remove')) handleDeleteEnrollment(record, meta?.anchorRect);
  };

  // ── Render ───────────────────────────────────────────────
  return (
    <div className="portal-view admin-academic-page">
      <Tabs defaultActiveKey="semesters" type="card" className="admin-academic-tabs" tabBarGutter={6}>

        {/* Terms */}
        <TabPane tab="Terms" key="semesters">
          <TermsTab
            form={formSemester}
            semesters={semesters}
            onCreate={handleCreateSemester}
            onReload={loadSemesters}
            onAction={handleAcademicAction}
          />
        </TabPane>

        {/* Courses */}
        <TabPane tab="Courses" key="courses">
          <CoursesTab
            form={formCourse}
            courses={courses}
            onCreate={handleCreateCourse}
            onReload={loadCourses}
            onAction={handleAcademicAction}
          />
        </TabPane>

        {/* Class Sections */}
        <TabPane tab="Class Sections" key="classes">
          <ClassSectionsTab
            form={formClass}
            courses={courses}
            classSections={classSections}
            selectedCourseId={selectedCourseId}
            academicLoading={academicLoading}
            mentors={mentorOptions}
            onCreate={handleCreateClass}
            onCourseSelect={handleCourseSelect}
            onAction={handleAcademicAction}
          />
        </TabPane>

        {/* Student Enrollments */}
        <TabPane tab="Student Enrollments" key="enrollments">
          <StudentEnrollmentsTab
            form={formEnroll}
            courses={courses}
            classSections={classSections}
            enrollmentSearchId={enrollmentSearchId}
            setEnrollmentSearchId={setEnrollmentSearchId}
            studentEnrollments={studentEnrollments}
            enrollmentsLoading={enrollmentsLoading}
            onCreate={handleCreateEnrollment}
            onCourseSelect={handleCourseSelect}
            onSearch={loadStudentEnrollments}
            onAction={handleAcademicAction}
          />
        </TabPane>

        {/* Student Import */}
        <TabPane tab="Import Students" key="student-import">
          <StudentImportTab
            form={formStudentImport}
            courses={courses}
            studentImportCourseId={studentImportCourseId}
            studentImportClassId={studentImportClassId}
            studentImportClasses={studentImportClasses}
            studentImportFile={studentImportFile}
            studentImportLoading={studentImportLoading}
            studentImportResult={studentImportResult}
            triggerToast={triggerToast}
            onDownloadTemplate={handleDownloadStudentTemplate}
            onCourseChange={loadStudentImportClasses}
            onClassChange={setStudentImportClassId}
            onFileChange={handleStudentImportFileChange}
            onFileRemove={handleStudentImportFileRemove}
            onImport={handleStudentImport}
          />
        </TabPane>

        {/* Course Materials */}
        <TabPane tab="Course Materials" key="materials">
          <CourseMaterialsTab
            form={formMaterial}
            courses={courses}
            materialCourseId={materialCourseId}
            materialFile={materialFile}
            materialUploadBusy={materialUploadBusy}
            courseMaterials={courseMaterials}
            materialsLoading={materialsLoading}
            onCourseChange={handleMaterialCourseChange}
            onFileChange={setMaterialFile}
            onFileRemove={() => setMaterialFile(null)}
            onUpload={handleUploadMaterial}
            onOpenWebsiteImport={() => setWebsiteImportOpen(true)}
            onReload={() => loadCourseMaterials()}
            onMaterialAction={(key, record, materialId, meta) => {
              if (key === 'view' || key === 'edit') openEntityModal('material', key, record);
              if (key === 'download') handleDownloadMaterial(materialId, record.title, record);
              if (key === 'reindex') handleReindexMaterial(materialId);
              if (key === 'delete') handleDeleteMaterial(materialId, meta?.anchorRect);
            }}
          />
        </TabPane>
      </Tabs>
      <EntityRecordModal
        entityModal={entityModal}
        entitySaving={entitySaving}
        form={formEntity}
        mentors={mentorOptions}
        onCancel={closeEntityModal}
        onSave={handleEntitySave}
      />
      {websiteImportOpen && (
        <Suspense fallback={null}>
          <ImportWebsiteModal
            open={websiteImportOpen}
            onClose={() => setWebsiteImportOpen(false)}
            courseId={materialCourseId}
            currentUser={currentUser}
            materialApi={materialsApi}
            triggerToast={triggerToast}
            onUploaded={handleWebsiteMaterialImported}
            isAdmin={true}
          />
        </Suspense>
      )}
    </div>
  );
}

export default AdminAcademic;
