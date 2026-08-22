import { useEffect } from 'react';
import PageHeader from '../../../components/common/PageHeader';
import { uiCopy } from '../../../constants/uiCopy';
import TeacherClassesTab from './TeacherClassesTab';
import { useTeacherDashboard } from '../dashboard/useTeacherDashboard';
import { findTeacherClass, getClassCourseId, getClassOptionValue } from '../shared/teacherUtils';
import TeacherActionCenter from './TeacherActionCenter';
import { useTeacherActionCenter } from './useTeacherActionCenter';

export default function TeacherClassesPage({
  currentUser,
  teacherId,
  courseId,
  setCourseId,
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

  useEffect(() => {
    if (dashboard.teacherDashboardLoading || !dashboard.classesList.length) return;
    const selectedExists = Boolean(findTeacherClass(dashboard.classesList, classId));
    if (selectedExists) return;
    const firstClass = dashboard.classesList[0];
    const nextClassId = getClassOptionValue(firstClass);
    const nextCourseId = getClassCourseId(firstClass);
    if (nextCourseId && nextCourseId !== courseId) setCourseId?.(nextCourseId);
    if (nextClassId) setClassId?.(nextClassId);
  }, [classId, courseId, dashboard.classesList, dashboard.teacherDashboardLoading, setClassId, setCourseId]);

  const selectAssignedClass = (item) => {
    const nextClassId = getClassOptionValue(item);
    const nextCourseId = getClassCourseId(item);
    if (nextCourseId && nextCourseId !== courseId) setCourseId?.(nextCourseId);
    if (nextClassId && nextClassId !== classId) setClassId?.(nextClassId);
  };

  const assignedClassCount = dashboard.classesList.length;
  const assignedStudentCount = dashboard.classesList.reduce((sum, item) => {
    const count = Number(item.studentCount);
    return Number.isFinite(count) ? sum + count : sum;
  }, 0);
  const pendingWorkCount = actionCenter.items.length;

  return (
    <div className="portal-section teacher-feature-page teacher-classes-page">
      <PageHeader
        eyebrow="Giảng dạy"
        title={uiCopy.teacher.classes.title}
        description={uiCopy.teacher.classes.subtitle}
        actions={(
          <div className="teacher-classes-header-stats">
            <div>
              <strong>{assignedClassCount}</strong>
              <span>Lớp phụ trách</span>
            </div>
            <div>
              <strong>{assignedStudentCount || '—'}</strong>
              <span>Sinh viên đã đếm</span>
            </div>
            <div>
              <strong>{pendingWorkCount}</strong>
              <span>Việc cần xử lý</span>
            </div>
          </div>
        )}
      />
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
        onSelectClass={selectAssignedClass}
        classesList={dashboard.classesList}
        teacherStudents={dashboard.teacherStudents}
        teacherDashboardLoading={dashboard.teacherDashboardLoading}
        classesLoading={dashboard.classesLoading}
        studentsLoading={dashboard.studentsLoading}
        loadTeacherDashboard={dashboard.loadTeacherDashboard}
        heatmapNodes={dashboard.teacherTopicHeatmap || []}
        triggerToast={triggerToast}
      />
    </div>
  );
}
