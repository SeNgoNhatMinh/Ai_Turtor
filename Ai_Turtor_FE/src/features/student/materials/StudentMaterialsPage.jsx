import { useEffect } from 'react';
import PageHeader from '../../../components/common/PageHeader';
import { uiCopy } from '../../../constants/uiCopy';
import { useCourseMaterialsController } from '../../../hooks/useCourseMaterialsController';
import CourseMaterialsPanel from './components/CourseMaterialsPanel';
import MaterialsCourseContext from './components/MaterialsCourseContext';
import './StudentMaterialsPage.css';

export default function StudentMaterialsPage({
  studentId,
  courseId,
  setCourseId,
  classId,
  triggerToast,
  enrollment,
  onLogout,
}) {
  const materials = useCourseMaterialsController({
    courseId,
    classId,
    studentId,
    triggerToast,
    skipUnauthorizedRedirect: true,
  });

  const handleCourseChange = (nextCourseId) => {
    if (enrollment?.selectCourse) {
      enrollment.selectCourse(nextCourseId);
      return;
    }
    setCourseId?.(nextCourseId);
  };

  useEffect(() => {
    materials.loadCourseMaterials({ page: 0, query: '' });
    // Route page owns material loading.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentId, courseId, classId]);

  return (
    <div className="portal-section student-materials-page">
      <PageHeader
        className="student-materials-page__header"
        eyebrow="Học liệu"
        title={uiCopy.student.materials.title}
        description={uiCopy.student.materials.subtitle}
      />
      <MaterialsCourseContext
        courseId={courseId}
        classId={classId}
        courseOptions={enrollment?.courseOptions || []}
        loading={enrollment?.isStudentEnrollmentsLoading || false}
        onCourseChange={handleCourseChange}
      />
      <CourseMaterialsPanel
        materials={materials.courseMaterials}
        loading={materials.isMaterialsLoading}
        error={materials.materialsError}
        courseId={courseId}
        classId={classId}
        onRetry={materials.loadCourseMaterials}
        onLoginAgain={onLogout}
        onDownload={materials.handleDownloadMaterial}
        pagination={materials.materialsPage}
        onPageChange={materials.changeMaterialsPage}
        onSearch={materials.searchMaterials}
      />
    </div>
  );
}
