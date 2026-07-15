import { Suspense, lazy, useEffect, useState } from 'react';
import { Form } from 'antd';
import { closeActiveConfirm } from '../../components/common/confirmDialog';
import { materialsApi } from '../../services/materialsApi';
import { adminUsersApi } from '../../services/adminUsersApi';
import { useAcademicEntityController } from '../../features/admin/academic/useAcademicEntityController';
import AdminAcademicTabs from './academic/AdminAcademicTabs';
import EntityRecordModal from './academic/EntityRecordModal';
import { useAcademicRecords } from './academic/hooks/useAcademicRecords';
import { useCourseMaterials } from './academic/hooks/useCourseMaterials';
import { useStudentImport } from './academic/hooks/useStudentImport';
import './AdminAcademic.css';

const ImportWebsiteModal = lazy(() => import('../../components/importWebsite/ImportWebsiteModal'));

function AdminAcademic({ triggerToast, currentUser }) {
  const [mentorOptions, setMentorOptions] = useState([]);
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

  useEffect(() => {
    academic.loadSemesters();
    academic.loadCourses();
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
    loadMentors();
    return () => closeActiveConfirm();
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
