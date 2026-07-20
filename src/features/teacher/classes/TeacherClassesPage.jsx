import { useEffect } from 'react';
import PageHeader from '../../../components/common/PageHeader';
import { uiCopy } from '../../../constants/uiCopy';
import TeacherClassesTab from '../../../pages/teacher/TeacherClassesTab';
import { useTeacherDashboard } from '../dashboard/useTeacherDashboard';
import TeacherActionCenter from './TeacherActionCenter';
import { useTeacherActionCenter } from './useTeacherActionCenter';

export default function TeacherClassesPage({
  currentUser,
  teacherId,
  courseId,
  classId,
  setClassId,
  switchTab,
  triggerToast,
}) {
  const dashboard = useTeacherDashboard({ teacherId, courseId, classId });
  const actionCenter = useTeacherActionCenter({
    teacherId,
    role: currentUser?.originalRole || currentUser?.role,
    courseId,
    classId,
  });

  useEffect(() => {
    dashboard.loadTeacherDashboard();
    // Dashboard is scoped by teacher/course/class.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teacherId, courseId, classId]);

  return (
    <div className="portal-section teacher-feature-page">
      <PageHeader title={uiCopy.teacher.classes.title} description={uiCopy.teacher.classes.subtitle} />
      <TeacherActionCenter
        items={actionCenter.items}
        loading={actionCenter.loading}
        error={actionCenter.error}
        hasScope={Boolean(courseId && classId)}
        onRefresh={actionCenter.load}
        onNavigate={switchTab}
      />
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
    </div>
  );
}
