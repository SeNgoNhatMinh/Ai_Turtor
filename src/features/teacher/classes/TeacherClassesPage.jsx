import { useEffect } from 'react';
import TeacherClassesTab from '../../../pages/teacher/TeacherClassesTab';
import { useTeacherDashboard } from '../dashboard/useTeacherDashboard';

export default function TeacherClassesPage({ teacherId, courseId, classId, setClassId, triggerToast }) {
  const dashboard = useTeacherDashboard({ teacherId, courseId, classId });

  useEffect(() => {
    dashboard.loadTeacherDashboard();
    // Dashboard is scoped by teacher/course/class.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teacherId, courseId, classId]);

  return (
    <TeacherClassesTab
      courseId={courseId}
      classId={classId}
      setClassId={setClassId}
      classesList={dashboard.classesList}
      teacherStudents={dashboard.teacherStudents}
      teacherDashboardLoading={dashboard.teacherDashboardLoading}
      loadTeacherDashboard={dashboard.loadTeacherDashboard}
      heatmapNodes={dashboard.teacherTopicHeatmap || []}
      triggerToast={triggerToast}
    />
  );
}
