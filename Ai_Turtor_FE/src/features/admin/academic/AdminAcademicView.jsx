import { Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react';
import { Form } from 'antd';
import { closeActiveConfirm } from '../../../components/common/confirmDialog';
import { materialsApi } from '../../../services/materialsApi';
import { adminUsersApi } from '../../../services/adminUsersApi';
import { useAcademicEntityController } from './useAcademicEntityController';
import AdminAcademicTabs from './components/AdminAcademicTabs';
import EntityRecordModal from './components/EntityRecordModal';
import { useAcademicRecords } from './hooks/useAcademicRecords';
import { useCourseMaterials } from './hooks/useCourseMaterials';
import { useStudentImport } from './hooks/useStudentImport';
import './AdminAcademic.css';

const ImportWebsiteModal = lazy(() => import('../../../components/importWebsite/ImportWebsiteModal'));

function AdminAcademic({ triggerToast, currentUser }) {
  const [mentorOptions, setMentorOptions] = useState([]);
  const [studentOptions, setStudentOptions] = useState([]);
  const [studentsLoading, setStudentsLoading] = useState(false);
  const studentSearchTimerRef = useRef(null);
  const referenceDataLoadedRef = useRef(false);
  const referenceDataLoadingRef = useRef(false);
  const [formSemester] = Form.useForm();
  const [formCourse] = Form.useForm();
  const [formClass] = Form.useForm();
  const [formEnroll] = Form.useForm();
  const [formMaterial] = Form.useForm();
  const [formStudentImport] = Form.useForm();
  const [formEntity] = Form.useForm();

  const academic = useAcademicRecords({
    triggerToast,
    formSemester,
    formCourse,
    formClass,
    formEnroll,
  });

  const materials = useCourseMaterials({ triggerToast, currentUser, formMaterial });
  const studentImport = useStudentImport({
    triggerToast,
    courses: academic.courses,
    formStudentImport,
    enrollmentSearchId: academic.enrollmentSearchId,
    loadStudentEnrollments: academic.loadStudentEnrollments,
  });

  const entity = useAcademicEntityController({
    triggerToast,
    form: formEntity,
    selectedCourseId: academic.selectedCourseId,
    materialCourseId: materials.materialCourseId,
    loadSemesters: academic.loadSemesters,
    loadCourses: academic.loadCourses,
    loadClassSections: academic.loadClassSections,
    loadStudentEnrollments: academic.loadStudentEnrollments,
    loadCourseMaterials: materials.loadCourseMaterials,
    deleteHandlers: {
      semester: academic.handleDeleteSemester,
      course: academic.handleDeleteCourse,
      classSection: academic.handleDeleteClassSection,
      enrollment: academic.handleDeleteEnrollment,
    },
  });

  const searchStudents = useCallback((query) => {
    window.clearTimeout(studentSearchTimerRef.current);
    const normalized = String(query || '').trim();
    if (normalized.length < 2) {
      setStudentOptions([]);
      setStudentsLoading(false);
      return;
    }
    setStudentsLoading(true);
    studentSearchTimerRef.current = window.setTimeout(async () => {
      try {
        const students = await adminUsersApi.getAdminUsers(normalized, 'STUDENT', true);
        setStudentOptions(Array.isArray(students) ? students : []);
      } catch {
        setStudentOptions([]);
      } finally {
        setStudentsLoading(false);
      }
    }, 300);
  }, []);

  useEffect(() => {
    const loadMentors = async () => {
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

    const loadReferenceData = async () => {
      if (referenceDataLoadingRef.current) return;
      referenceDataLoadingRef.current = true;
      try {
        const results = await Promise.allSettled([
          academic.loadSemesters(),
          academic.loadCourses(),
          loadMentors(),
        ]);
        referenceDataLoadedRef.current = results.every((result) => result.status === 'fulfilled');
        if (!referenceDataLoadedRef.current) {
          triggerToast?.('Một số dữ liệu học vụ chưa tải được. Hệ thống sẽ tự thử lại.');
        }
      } finally {
        referenceDataLoadingRef.current = false;
      }
    };

    const reloadMissingReferenceData = () => {
      if (!referenceDataLoadedRef.current && document.visibilityState === 'visible') {
        loadReferenceData();
      }
    };

    loadReferenceData();
    window.addEventListener('online', reloadMissingReferenceData);
    document.addEventListener('visibilitychange', reloadMissingReferenceData);
    return () => {
      window.clearTimeout(studentSearchTimerRef.current);
      window.removeEventListener('online', reloadMissingReferenceData);
      document.removeEventListener('visibilitychange', reloadMissingReferenceData);
      closeActiveConfirm();
    };
    // Reference data is loaded once when the admin workspace mounts.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="portal-view admin-academic-page">
      <AdminAcademicTabs
        forms={{
          semester: formSemester,
          course: formCourse,
          classSection: formClass,
          enrollment: formEnroll,
          material: formMaterial,
          studentImport: formStudentImport,
        }}
        academic={academic}
        materials={materials}
        studentImport={studentImport}
        mentors={mentorOptions}
        studentOptions={studentOptions}
        studentsLoading={studentsLoading}
        onStudentSearch={searchStudents}
        triggerToast={triggerToast}
        onAcademicAction={entity.handleAcademicAction}
        onOpenEntity={entity.openEntityModal}
      />
      <EntityRecordModal
        entityModal={entity.entityModal}
        entitySaving={entity.entitySaving}
        form={formEntity}
        mentors={mentorOptions}
        onCancel={entity.closeEntityModal}
        onSave={entity.saveEntity}
      />
      {materials.websiteImportOpen && (
        <Suspense fallback={null}>
          <ImportWebsiteModal
            open={materials.websiteImportOpen}
            onClose={() => materials.setWebsiteImportOpen(false)}
            courseId={materials.materialCourseId}
            currentUser={currentUser}
            materialApi={materialsApi}
            triggerToast={triggerToast}
            onUploaded={materials.handleWebsiteMaterialImported}
            isAdmin
          />
        </Suspense>
      )}
    </div>
  );
}

export default AdminAcademic;
