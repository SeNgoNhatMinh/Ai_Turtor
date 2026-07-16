import { lazy, Suspense, useEffect, useMemo } from 'react';
import AsyncState from '../../components/common/AsyncState';
import { useStudentEnrollmentOptions } from '../../hooks/useStudentEnrollmentOptions';

const studentPages = {
  'student-chat': lazy(() => import('../../features/student/chat/StudentChatPage')),
  'student-memory': lazy(() => import('../../features/student/learning/LearningProgressPage')),
  'student-quizzes': lazy(() => import('../../features/student/quizzes/PracticeQuizzesPage')),
  'student-materials': lazy(() => import('../../features/student/materials/StudentMaterialsPage')),
  'student-escalation': lazy(() => import('../../features/student/mentor-review/MentorReviewPage')),
};

function StudentPageFallback() {
  return <AsyncState loading loadingLabel="Loading student page..." loadingRows={6} />;
}

export default function StudentWorkspace({
  currentUser,
  activeTab,
  switchTab,
  courseId,
  setCourseId,
  classId,
  setClassId,
  isDarkMode,
  triggerToast,
}) {
  const currentUserId = currentUser?.userId || currentUser?.id || '';
  const studentLookupIds = useMemo(() => [
    currentUser?.studentId,
    currentUser?.studentCode,
    currentUser?.email,
    currentUser?._id,
  ], [currentUser]);
  const enrollment = useStudentEnrollmentOptions({
    studentId: currentUserId,
    lookupIds: studentLookupIds,
    courseId,
    classId,
    setCourseId,
    setClassId,
  });
  const studentId = enrollment.resolvedStudentId || currentUserId;
  const Page = studentPages[activeTab];

  useEffect(() => {
    if (!currentUserId) return;
    enrollment.loadStudentEnrollments();
    // Enrollment is identity-scoped; course selection is derived from this response.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUserId]);

  if (!Page) return null;

  return (
    <Suspense fallback={<StudentPageFallback />}>
      <Page
        currentUser={currentUser}
        studentId={studentId}
        courseId={courseId}
        setCourseId={setCourseId}
        classId={classId}
        isDarkMode={isDarkMode}
        switchTab={switchTab}
        triggerToast={triggerToast}
        enrollment={enrollment}
      />
    </Suspense>
  );
}
