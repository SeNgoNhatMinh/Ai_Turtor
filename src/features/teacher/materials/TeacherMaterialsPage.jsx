import { useEffect } from 'react';
import PageHeader from '../../../components/common/PageHeader';
import { uiCopy } from '../../../constants/uiCopy';
import { useCourseMaterialsController } from '../../../hooks/useCourseMaterialsController';
import { materialsApi } from '../../../services/materialsApi';
import { useTeacherDashboard } from '../dashboard/useTeacherDashboard';
import { findTeacherClass, getClassCourseId, getClassOptionValue } from '../shared/teacherUtils';
import TeacherMaterialsView from './TeacherMaterialsView';
import { useTeacherAssignmentsController } from './useTeacherAssignmentsController';
import { useTeacherMaterialController } from './useTeacherMaterialController';
import './TeacherMaterialsPage.css';

export default function TeacherMaterialsPage({
  currentUser,
  teacherId,
  courseId,
  setCourseId,
  classId,
  setClassId,
  triggerToast,
}) {
  const dashboard = useTeacherDashboard({ teacherId, courseId, classId });
  const courseMaterialData = useCourseMaterialsController({ courseId, classId, teacherId, triggerToast });
  const assignments = useTeacherAssignmentsController({
    courseId,
    classId,
    teacherUserId: teacherId,
    triggerToast,
  });
  const materials = useTeacherMaterialController({
    courseId,
    classId,
    teacherUserId: teacherId,
    onReload: courseMaterialData.loadCourseMaterials,
    onAccepted: courseMaterialData.upsertCourseMaterial,
    courseMaterials: courseMaterialData.courseMaterials,
    triggerToast,
  });

  useEffect(() => {
    dashboard.loadTeacherDashboard();
    courseMaterialData.loadCourseMaterials();
    assignments.load();
    // Materials route owns these three independent resources.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teacherId, courseId, classId]);

  useEffect(() => {
    if (dashboard.teacherDashboardLoading || !dashboard.classesList.length) return;
    const matchedClass = findTeacherClass(dashboard.classesList, classId);
    const selectedClass = matchedClass || (!classId && dashboard.classesList.length === 1
      ? dashboard.classesList[0]
      : null);
    if (!selectedClass) return;

    const canonicalClassId = String(getClassOptionValue(selectedClass) || '');
    const canonicalCourseId = String(getClassCourseId(selectedClass) || '');
    if (canonicalClassId && canonicalClassId !== String(classId || '')) {
      setClassId?.(canonicalClassId);
    }
    if (canonicalCourseId && canonicalCourseId !== String(courseId || '')) {
      setCourseId?.(canonicalCourseId);
    }
  }, [
    classId,
    courseId,
    dashboard.classesList,
    dashboard.teacherDashboardLoading,
    setClassId,
    setCourseId,
  ]);

  const handleMaterialClassChange = (nextClassId, option = {}) => {
    const selectedClass = findTeacherClass(dashboard.classesList, nextClassId);
    const canonicalClassId = option.classId || selectedClass?.classId || nextClassId;
    const nextCourseId = option.courseId || getClassCourseId(selectedClass);

    setCourseId?.(nextCourseId || '');
    setClassId?.(canonicalClassId);
  };

  return (
    <div className="portal-section teacher-feature-page">
      <PageHeader title={uiCopy.teacher.materials.title} description={uiCopy.teacher.materials.subtitle} />
      <TeacherMaterialsView
        scope={{
          courseId,
          classId,
          classesList: dashboard.classesList,
          classesLoading: dashboard.teacherDashboardLoading,
          onClassChange: handleMaterialClassChange,
        }}
        assignments={assignments}
        materials={materials}
        teacherStudents={dashboard.teacherStudents}
        courseMaterials={courseMaterialData.courseMaterials}
        onReloadCourseMaterials={courseMaterialData.loadCourseMaterials}
        onDownloadMaterial={courseMaterialData.handleDownloadMaterial}
        materialApi={materialsApi}
        triggerToast={triggerToast}
        currentUser={currentUser}
      />
    </div>
  );
}
