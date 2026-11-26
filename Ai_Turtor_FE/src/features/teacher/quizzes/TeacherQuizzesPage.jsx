import QuizAssignments from './QuizAssignments';
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
