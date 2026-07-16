import { useEffect } from 'react';
import TeacherMaterialsAssignmentsTab from '../../../pages/teacher/TeacherMaterialsAssignmentsTab';
import { useCourseMaterialsController } from '../../../hooks/useCourseMaterialsController';
import { useTeacherMaterialsAssignments } from '../../../hooks/useTeacherMaterialsAssignments';
import { materialsApi } from '../../../services/materialsApi';
import { useTeacherDashboard } from '../dashboard/useTeacherDashboard';

export default function TeacherMaterialsPage({
  currentUser,
  teacherId,
  courseId,
  classId,
  triggerToast,
}) {
  const dashboard = useTeacherDashboard({ teacherId, courseId, classId });
  const materials = useCourseMaterialsController({ courseId, classId, teacherId, triggerToast });
  const assignments = useTeacherMaterialsAssignments({
    courseId,
    classId,
    teacherUserId: teacherId,
    onReloadCourseMaterials: materials.loadCourseMaterials,
    triggerToast,
  });

  useEffect(() => {
    dashboard.loadTeacherDashboard();
    materials.loadCourseMaterials();
    assignments.loadClassAssignments();
    // Materials route owns these three independent resources.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teacherId, courseId, classId]);

  return (
    <TeacherMaterialsAssignmentsTab
      {...assignments}
      classId={classId}
      classesList={dashboard.classesList}
      teacherStudents={dashboard.teacherStudents}
      courseMaterials={materials.courseMaterials}
      onReloadCourseMaterials={materials.loadCourseMaterials}
      onDownloadMaterial={materials.handleDownloadMaterial}
      materialApi={materialsApi}
      triggerToast={triggerToast}
      currentUser={currentUser}
      courseId={courseId}
    />
  );
}
