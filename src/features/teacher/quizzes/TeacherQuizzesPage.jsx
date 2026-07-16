import { useEffect } from 'react';
import QuizAssignments from '../../../pages/teacher/QuizAssignments';
import { useTeacherDashboard } from '../dashboard/useTeacherDashboard';

export default function TeacherQuizzesPage({ currentUser, teacherId, courseId, classId, triggerToast }) {
  const dashboard = useTeacherDashboard({ teacherId, courseId, classId });

  useEffect(() => {
    dashboard.loadTeacherDashboard();
    // Student targets are loaded for the selected class.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teacherId, courseId, classId]);

  return (
    <QuizAssignments
      teacherId={teacherId}
      teacherName={currentUser?.fullName || currentUser?.name || ''}
      courseId={courseId}
      classId={classId}
      teacherStudents={dashboard.teacherStudents}
      triggerToast={triggerToast}
    />
  );
}
