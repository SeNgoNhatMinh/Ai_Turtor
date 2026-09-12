import { Suspense, lazy, useEffect, useState } from 'react';
import { Form } from 'antd';
import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '../../../app/queryKeys';
import { closeActiveConfirm } from '../../../components/common/confirmDialog';
import { materialsApi } from '../../../services/materialsApi';
import { adminUsersApi } from '../../../services/adminUsersApi';
import { useAcademicEntityController } from './useAcademicEntityController';
import AdminAcademicTabs from './components/AdminAcademicTabs';
import EntityRecordModal from './components/EntityRecordModal';
import { useAcademicRecords } from './hooks/useAcademicRecords';
import { useCourseMaterials } from './hooks/useCourseMaterials';
import { useStudentImport } from './hooks/useStudentImport';
import { useDebouncedValue } from '../../../hooks/useDebouncedValue';
import './AdminAcademic.css';

const ImportWebsiteModal = lazy(() => import('../../../components/importWebsite/ImportWebsiteModal'));

function AdminAcademic({ triggerToast, currentUser }) {
  const [studentSearch, setStudentSearch] = useState('');
  const debouncedStudentSearch = useDebouncedValue(studentSearch.trim(), 300);
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

  const materials = useCourseMaterials({
    triggerToast,
    currentUser,
    formMaterial,
    onCourseSyllabusUpdated: academic.loadCourses,
  });

  const mentorOptionsQuery = useQuery({
    queryKey: queryKeys.adminMentorOptions(),
    queryFn: async ({ signal }) => {
      try {
        return await adminUsersApi.getMentors('', { signal });
      } catch (error) {
        if (signal.aborted) throw error;
        const mentors = await adminUsersApi.getAdminMentors('', { signal });
        return mentors.filter((mentor) => mentor.isActive !== false);
      }
    },
    staleTime: 5 * 60_000,
  });
  const studentOptionsQuery = useQuery({
    queryKey: queryKeys.adminStudentSearch(debouncedStudentSearch),
    queryFn: ({ signal }) => adminUsersApi.getAdminUsers(
      debouncedStudentSearch,
      'STUDENT',
      true,
      { signal },
    ),
    enabled: debouncedStudentSearch.length >= 2,
    staleTime: 60_000,
  });
  const mentorOptions = mentorOptionsQuery.data || [];
  const studentOptions = debouncedStudentSearch.length >= 2 ? studentOptionsQuery.data || [] : [];
  const studentsLoading = debouncedStudentSearch.length >= 2
    && (studentOptionsQuery.isPending || studentOptionsQuery.isFetching);
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
    onMaterialSyllabusUpdated: (syllabusDescription) => {
      formMaterial.setFieldValue('syllabusDescription', syllabusDescription);
    },
    deleteHandlers: {
      semester: academic.handleDeleteSemester,
      course: academic.handleDeleteCourse,
      classSection: academic.handleDeleteClassSection,
      enrollment: academic.handleDeleteEnrollment,
    },
  });

  useEffect(() => {
    return () => {
      closeActiveConfirm();
    };
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
        onStudentSearch={setStudentSearch}
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
            syllabusDescription={formMaterial.getFieldValue('syllabusDescription') || ''}
          />
        </Suspense>
      )}
    </div>
  );
}

export default AdminAcademic;
