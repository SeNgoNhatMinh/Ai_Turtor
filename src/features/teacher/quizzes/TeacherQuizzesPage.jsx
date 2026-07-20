import { useEffect } from 'react';
import QuizAssignments from '../../../pages/teacher/QuizAssignments';
import { useTeacherDashboard } from '../dashboard/useTeacherDashboard';
import { findTeacherClass, getClassCourseId } from '../shared/teacherUtils';

export default function TeacherQuizzesPage({
  currentUser,
  teacherId,
  courseId,
  setCourseId,
  classId,
  setClassId,
  triggerToast,
}) {
  const dashboard = useTeacherDashboard({ teacherId, courseId, classId });

  useEffect(() => {
    dashboard.loadTeacherDashboard();
    // Student targets are loaded for the selected class.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teacherId, courseId, classId]);

  const handleClassChange = (nextClassId) => {
    const selectedClass = findTeacherClass(dashboard.classesList, nextClassId);
    const nextCourseId = getClassCourseId(selectedClass);
    if (nextCourseId) setCourseId?.(nextCourseId);
    setClassId?.(nextClassId);
  };

  return (
    <QuizAssignments
      teacherId={teacherId}
      teacherName={currentUser?.fullName || currentUser?.name || ''}
      courseId={courseId}
      classId={classId}
      classesList={dashboard.classesList}
      classesLoading={dashboard.teacherDashboardLoading}
      onClassChange={handleClassChange}
      teacherStudents={dashboard.teacherStudents}
      triggerToast={triggerToast}
    />
  );
}
